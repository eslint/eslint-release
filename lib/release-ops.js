/**
 * @fileoverview Build file
 * @author nzakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("node:fs"),
    path = require("node:path"),
    semver = require("semver"),
    GitHub = require("github-api"),
    dateformat = require("dateformat"),
    ShellOps = require("./shell-ops");

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

const commitTagMap = new Map([
    ["fix", "fix"],
    ["fix!", "breaking"],
    ["build", "build"],
    ["chore", "chore"],
    ["perf", "chore"],
    ["ci", "chore"],
    ["refactor", "chore"],
    ["test", "chore"],
    ["docs", "docs"],
    ["update", "update"],
    ["upgrade", "upgrade"],
    ["new", "new"],
    ["feat", "new"],
    ["breaking", "breaking"],
    ["feat!", "breaking"]
]);

// var OPEN_SOURCE_LICENSES = [
//     /MIT/, /BSD/, /Apache/, /ISC/, /WTF/, /Public Domain/
// ];

/**
 * Tests if a file exists.
 * @param {string} file The path of the file to be tested.
 * @returns {boolean} `true` if the specified path denotes an existing file, otherwise `false`.
 */
function fileExists(file) {

    // We can't use the `throwIfNoEntry` option with `fs.statSync`, because it's not supported in Node.js 10,
    // so we check if the file exists in advance.
    if (!fs.existsSync(file)) {
        return false;
    }
    return fs.statSync(file).isFile();
}

/**
 * Loads the package.json file from the current directory.
 * @returns {void}
 * @private
 */
function getPackageInfo() {
    const filePath = path.join(process.cwd(), "package.json");

    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Run before a release to validate that the project is setup correctly.
 * @returns {void}
 * @private
 */
function validateSetup() {
    if (!fileExists("package.json")) {
        console.error("Missing package.json file");
        ShellOps.exit(1);
    }

    const pkg = getPackageInfo();

    if (!pkg.files || pkg.files.length === 0) {
        console.error("Missing 'files' property in package.json");
        ShellOps.exit(1);
    }

    // check repository field
    if (!pkg.repository) {
        console.error("Missing 'repository' in package.json");
        ShellOps.exit(1);
    } else if (!/^[\w-]+\/[\w-]+$/.test(pkg.repository)) {
        console.error("The 'repository' field must be in the format 'foo/bar' in package.json");
        ShellOps.exit(1);
    }
}

/**
 * Verify that the appropriate credentials are present before publishing a release
 * @returns {void}
 */
function validateEnvironment() {
    if (!process.env.NPM_TOKEN) {
        console.error("Missing NPM_TOKEN environment variable");
        ShellOps.exit(1);
    }

    if (!process.env.ESLINT_GITHUB_TOKEN) {
        console.error("Missing ESLINT_GITHUB_TOKEN environment variable");
        ShellOps.exit(1);
    }
}

/**
 * Determines the next prerelease version based on the current version.
 * @param {string} currentVersion The current semver version.
 * @param {string} prereleaseId The ID of the prelease (alpha, beta, rc, etc.)
 * @param {string} releaseType The type of prerelease to generate (major, minor, patch)
 * @returns {string} The prerelease version.
 * @private
 */
function getPrereleaseVersion(currentVersion, prereleaseId, releaseType) {
    const ver = new semver.SemVer(currentVersion);

    // if it's already a prerelease version
    if (ver.prerelease.length) {
        return ver.inc("prerelease", prereleaseId).version;
    }
    return ver.inc(`pre${releaseType}`, prereleaseId).version;

}

/**
 * Returns the version tags from the git repository
 * @returns {string[]} Tags
 * @private
 */
function getVersionTags() {

    // Using `--merged` to only list tags whose commits are reachable from HEAD
    const tags = ShellOps.execSilent("git tag --merged").trim().split("\n");

    return tags.reduce((list, tag) => {
        if (semver.valid(tag)) {
            list.push(tag);
        }
        return list;
    }, []).sort(semver.compare);
}

/**
 * Extracts data from a commit log in the format --pretty=format:"* %h %s (%an)\n%b".
 * @param {string[]} logs Output from git log command.
 * @returns {Object} An object containing the data exracted from the commit log.
 * @private
 */
function parseLogs(logs) {
    const regexp = /^\* ([0-9a-f]{40}) ((?:([a-z]+!?): ?)?.*) \((.*)\)/i,
        parsed = [];

    logs.forEach(log => {
        const match = log.match(regexp);

        if (match) {
            parsed.push({
                raw: match[0],
                sha: match[1],
                title: match[2],
                flag: commitTagMap.get(match[3] ? match[3].toLowerCase() : null),
                author: match[4],
                body: ""
            });
        } else if (parsed.length) {
            parsed.at(-1).body += `${log}\n`;
        }

    });

    return parsed;
}

/**
 * Given a list of parsed commit log messages, excludes revert commits and the
 * commits they reverted.
 * @param {Object[]} logs An array of parsed commit log messages.
 * @returns {Object[]} An array of parsed commit log messages.
 */
function excludeRevertsAndSponsorSyncs(logs) {
    const newLogs = logs.slice();

    const revertRegex = /This reverts commit ([0-9a-f]{40})/,
        shaIndexMap = Object.create(null); // Map of commit shas to indices
    let i, log, match, sha;

    // iterate in reverse because revert commits have lower indices than the
    // commits they revert
    for (i = newLogs.length - 1; i >= 0; i--) {
        log = newLogs[i];
        match = log.body.match(revertRegex);

        if (match) {
            sha = match[1];

            // only exclude this revert if we can find the commit it reverts
            if (typeof shaIndexMap[sha] !== "undefined") {
                newLogs[shaIndexMap[sha]] = null;
                newLogs[i] = null;
            }
        } else if (log.title.startsWith('Sponsors: Sync')) {
            newLogs[i] = null;
        } else {
            shaIndexMap[log.sha] = i;
        }
    }

    return newLogs.filter(Boolean);
}

/**
 * Inspects an array of git commit log messages and calculates the release
 * information based on it.
 * @param {string} currentVersion The version of the project read from package.json.
 * @param {string[]} logs An array of log messages for the release.
 * @param {string} [prereleaseId] If doing a prerelease, the prerelease identifier.
 * @returns {Object} An object containing all the changes since the last version.
 * @private
 */
function calculateReleaseFromGitLogs(currentVersion, logs, prereleaseId) {

    const excludedLogs = excludeRevertsAndSponsorSyncs(parseLogs(logs));

    const changelog = {},
        repository = getPackageInfo().repository;

    /**
     * Generates a formatted line with a link to commits on GitHub
     * @param {string} log A parsed log message with a full commit hash
     * @returns {string} A line for a changelog with a link to the GitHub commit
     */
    function generateChangelogLine(log) {
        return log.raw.replace(
            /^\* ([0-9a-f]{40})/,
            (_, hash) => `* [\`${hash.slice(0, 7)}\`](https://github.com/${repository}/commit/${hash})`
        );
    }
    const releaseInfo = {
        version: currentVersion,
        type: "",
        changelog,
        rawChangelog: excludedLogs.map(generateChangelogLine).join("\n")
    };

    // arrange change types into categories
    excludedLogs.forEach(log => {

        // exclude untagged (e.g. revert) commits from version calculation
        if (!log.flag) {
            return;
        }

        if (!changelog[log.flag]) {
            changelog[log.flag] = [];
        }

        changelog[log.flag].push(generateChangelogLine(log));
    });

    if (changelog.breaking) {
        releaseInfo.type = "major";
    } else if (changelog.new || changelog.update) {
        releaseInfo.type = "minor";
    } else {
        releaseInfo.type = "patch";
    }

    // increment version from current version
    releaseInfo.version = (
        prereleaseId
            ? getPrereleaseVersion(currentVersion, prereleaseId, releaseInfo.type)
            : semver.inc(currentVersion, releaseInfo.type)
    );

    return releaseInfo;
}

/**
 * Gets the range of commits to include in a changelog.
 * If this will be the first stable release following a prerelease sequence,
 * all commits going back to the previous stable release are included.
 * @param {string[]} tags All prior version tags.
 * @param {string} [prereleaseId] The prerelease identifier if this is a prerelease.
 * @returns {string} The commit range to include in the changelog.
 * @private
 */
function getChangelogCommitRange(tags, prereleaseId) {
    let lastTag;

    // If this will be a stable release after a prerelease...
    if (!prereleaseId && semver.prerelease(tags.at(-1))) {
        let i = 2;

        do {
            lastTag = tags[tags.length - i];
            i++;
        } while (semver.prerelease(lastTag));
    } else {
        lastTag = tags.at(-1);
    }

    return lastTag ? `${lastTag}..HEAD` : "";
}

/**
 * Gets all changes for this release.
 * If this will be the first stable release following a prerelease sequence,
 * all changes from all prereleases since the last stable release are included.
 * @param {string} [prereleaseId] The prerelease identifier if this is a prerelease.
 * @returns {Object} An object containing all the changes since the last version.
 * @private
 */
function calculateReleaseInfo(prereleaseId) {

    // get last version tag
    const pkg = getPackageInfo(),
        tags = getVersionTags(),
        commitRange = getChangelogCommitRange(tags, prereleaseId);

    // get log statements
    const logs = ShellOps.execSilent(`git log --no-merges --pretty=format:"* %H %s (%an)%n%b" ${commitRange}`).split(/\n/g);
    const releaseInfo = calculateReleaseFromGitLogs(pkg.version, logs, prereleaseId);

    releaseInfo.repository = pkg.repository;
    return releaseInfo;
}

/**
 * Outputs the changelog to disk.
 * @param {Object} releaseInfo The information about the release.
 * @param {string} releaseInfo.version The release version.
 * @param {Object} releaseInfo.changelog The changelog information.
 * @returns {void}
 */
function writeChangelog(releaseInfo) {

    // get today's date in "mmmm d, yyyy" format
    const now = new Date(),
        today = dateformat(now, "mmmm d, yyyy");

    releaseInfo.markdownChangelog = `v${releaseInfo.version} - ${today}\n\n${releaseInfo.rawChangelog}\n\n`;

    // output header and changelog
    fs.writeFileSync(
        "CHANGELOG.tmp",
        releaseInfo.markdownChangelog
    );

    // ensure there's a CHANGELOG.md file
    if (!fileExists("CHANGELOG.md")) {
        fs.writeFileSync("CHANGELOG.md", "");
    }

    const data = `${fs.readFileSync("CHANGELOG.tmp", "utf-8")}${fs.readFileSync("CHANGELOG.md", "utf-8")}`;

    fs.writeFileSync("CHANGELOG.md.tmp", data);
    fs.unlinkSync("CHANGELOG.tmp");
    fs.unlinkSync("CHANGELOG.md");
    fs.renameSync("CHANGELOG.md.tmp", "CHANGELOG.md");
}

/**
 * Creates a release version tag and pushes to origin and npm.
 * @param {string} [prereleaseId] The prerelease ID (alpha, beta, rc, etc.).
 *      Only include when doing a prerelease.
 * @param {string} [packageTag] Tag added to the package submitted to the npm registry.
 * @returns {void} No value returned.
 */
function generateRelease(prereleaseId, packageTag = prereleaseId ? "next" : "latest") {

    validateSetup();

    console.log("Running tests");
    ShellOps.execSilent("npm test");

    console.log("Calculating changes for release");
    const releaseInfo = calculateReleaseInfo(prereleaseId);

    releaseInfo.packageTag = packageTag;

    console.log("Release is %s", releaseInfo.version);
    console.log("Package tag is %s", releaseInfo.packageTag);

    console.log("Generating changelog");
    writeChangelog(releaseInfo);

    console.log("Committing to git");
    ShellOps.exec("git add CHANGELOG.md");
    ShellOps.exec(`git commit -m "Build: changelog update for ${releaseInfo.version}"`);

    console.log("Generating %s", releaseInfo.version);
    ShellOps.execSilent(`npm version ${releaseInfo.version}`);

    console.log("Fixing line endings");
    getPackageInfo().files.filter(dirPath => fs.lstatSync(dirPath).isDirectory()).forEach(filePath => {
        if (fs.existsSync(filePath)) {
            ShellOps.execSilent(`linefix ${filePath}`);
        }
    });

    fs.writeFileSync(".eslint-release-info.json", JSON.stringify(releaseInfo, null, 4));
}

/**
 * Creates release body text from a changelog information.
 * @param {Object} [changelog] The changelog information.
 * @returns {string} THe release body text
 */
function generateReleaseBody(changelog) {
    const logFlags = [
        { flag: "breaking", title: "Breaking Changes" },
        { flag: "new", title: "Features" },
        { flag: "update", title: "Enhancements" },
        { flag: "fix", title: "Bug Fixes" },
        { flag: "docs", title: "Documentation" },
        { flag: "upgrade", title: "Dependency Upgrades" },
        { flag: "build", title: "Build Related" },
        { flag: "chore", title: "Chores" }
    ];

    return logFlags
        .map(({ flag, title }) => ({ title, logs: changelog[flag] }))
        .filter(({ logs }) => logs && logs.length > 0)
        .map(({ title, logs }) => `## ${title}\n${logs.join("\n")}`)
        .join("\n\n");
}

/**
 * Publishes the release information to GitHub.
 * @param {Object} releaseInfo The release information object.
 * @returns {Promise<any>} A promise that resolves when the operation is complete.
 * @private
 */
function publishReleaseToGitHub(releaseInfo) {

    const repoParts = releaseInfo.repository.split("/"),
        gh = new GitHub({ token: process.env.ESLINT_GITHUB_TOKEN }),
        repo = gh.getRepo(repoParts[0], repoParts[1]),
        tag = `v${releaseInfo.version}`;

    return repo.createRelease({
        tag_name: tag, // eslint-disable-line camelcase -- required
        body: generateReleaseBody(releaseInfo.changelog),
        prerelease: !!semver.prerelease(releaseInfo.version),
        make_latest: String(releaseInfo.packageTag === "latest") // eslint-disable-line camelcase -- required
    }).then(() => {
        console.log("Posted release notes to GitHub");
    }).catch(ex => {
        console.error("Could not post release notes to GitHub");
        if (ex.message) {
            console.error(ex.message);
        }
    });

}

/**
 * Push the commit and git tags, publish to npm, and publish a changelog to GitHub release notes.
 * @returns {Object} the information about the release.
 */
function publishRelease() {
    validateSetup();
    validateEnvironment();
    const releaseInfo = JSON.parse(fs.readFileSync(".eslint-release-info.json", "utf8"));

    let oldNpmrcContents;

    if (fs.existsSync(".npmrc")) {
        oldNpmrcContents = fs.readFileSync(".npmrc", "utf8");
    } else {
        oldNpmrcContents = null;
    }

    // Release needs a .npmrc file to work properly - token is read from environment
    console.log("Writing .npmrc file");
    fs.writeFileSync(".npmrc", "//registry.npmjs.org/:_authToken=${NPM_TOKEN}");

    // if there's a prerelease ID, publish under "next" tag
    console.log("Publishing to npm");

    let command = `npm publish --tag ${releaseInfo.packageTag}`;

    if (process.env.NPM_OTP && /^\d+$/.test(process.env.NPM_OTP)) {
        command += ` --otp=${process.env.NPM_OTP}`;
    }

    ShellOps.exec(command);

    if (oldNpmrcContents === null) {
        fs.unlinkSync(".npmrc");
    } else {
        fs.writeFileSync(".npmrc", oldNpmrcContents);
    }

    console.log("Publishing to git");
    ShellOps.exec("git push origin HEAD --tags");

    publishReleaseToGitHub(releaseInfo);

    return releaseInfo;
}

//------------------------------------------------------------------------------
// Public API
//------------------------------------------------------------------------------

module.exports = {
    getPrereleaseVersion,
    generateRelease,
    publishRelease,
    calculateReleaseInfo,
    getChangelogCommitRange,
    calculateReleaseFromGitLogs,
    writeChangelog,
    generateReleaseBody
};
