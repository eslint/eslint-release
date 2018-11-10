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

var fs = require("fs"),
    path = require("path"),
    shelljs = require("shelljs"),
    semver = require("semver"),
    GitHub = require("github-api"),
    dateformat = require("dateformat"),
    ShellOps = require("./shell-ops");

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

// var OPEN_SOURCE_LICENSES = [
//     /MIT/, /BSD/, /Apache/, /ISC/, /WTF/, /Public Domain/
// ];

/**
 * Loads the package.json file from the current directory.
 * @returns {void}
 * @private
 */
function getPackageInfo() {
    var filePath = path.join(process.cwd(), "package.json");
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

/**
 * Run before a release to validate that the project is setup correctly.
 * @returns {void}
 * @private
 */
function validateSetup() {
    if (!shelljs.test("-f", "package.json")) {
        console.error("Missing package.json file");
        ShellOps.exit(1);
    }

    var pkg = getPackageInfo();
    if (!pkg.files || pkg.files.length === 0) {
        console.error("Missing 'files' property in package.json");
        ShellOps.exit(1);
    }

    // check repository field
    if (!pkg.repository) {
        console.error("Missing 'repository' in package.json");
        ShellOps.exit(1);
    } else if (!/^[\w\-]+\/[\w\-]+$/.test(pkg.repository)) {
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
    var ver = new semver.SemVer(currentVersion);

    // if it's already a prerelease version
    if (ver.prerelease.length) {
        return ver.inc("prerelease", prereleaseId).version;
    } else {
        return ver.inc("pre" + releaseType, prereleaseId).version;
    }
}

/**
 * Returns the version tags from the git repository
 * @returns {string[]} Tags
 * @private
 */
function getVersionTags() {
    var tags = ShellOps.execSilent("git tag").trim().split("\n");

    return tags.reduce(function(list, tag) {
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
    var regexp = /^\* ([0-9a-f]{40}) ((?:([a-z]+): ?)?.*) \((.*)\)/i,
        parsed = [];

    logs.forEach(function(log) {
        var match = log.match(regexp);

        if (match) {
            parsed.push({
                raw: match[0],
                sha: match[1],
                title: match[2],
                flag: match[3] ? match[3].toLowerCase() : null,
                author: match[4],
                body: ""
            });
        } else if (parsed.length) {
            parsed[parsed.length - 1].body += log + "\n";
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
function excludeReverts(logs) {
    logs = logs.slice();

    var revertRegex = /This reverts commit ([0-9a-f]{40})/,
        shaIndexMap = Object.create(null), // Map of commit shas to indices
        i, log, match, sha;

    // iterate in reverse because revert commits have lower indices than the
    // commits they revert
    for (i = logs.length - 1; i >= 0; i--) {
        log = logs[i];
        match = log.body.match(revertRegex);

        if (match) {
            sha = match[1];

            // only exclude this revert if we can find the commit it reverts
            if (typeof shaIndexMap[sha] !== "undefined") {
                logs[shaIndexMap[sha]] = null;
                logs[i] = null;
            }
        } else {
            shaIndexMap[log.sha] = i;
        }
    }

    return logs.filter(Boolean);
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

    logs = excludeReverts(parseLogs(logs));

    var changelog = {},
        repository = getPackageInfo().repository;

    /**
     * Generates a formatted line with a link to commits on GitHub
     * @param {string} log A parsed log message with a full commit hash
     * @returns {string} A line for a changelog with a link to the GitHub commit
     */
    function generateChangelogLine(log) {
        return log.raw.replace(/^\* ([0-9a-f]{40})/, function(_, hash) {
            return "* [`" + hash.slice(0, 7) + "`](https://github.com/" + repository + "/commit/" + hash + ")";
        });
    }
    var releaseInfo = {
        version: currentVersion,
        type: "",
        changelog: changelog,
        rawChangelog: logs.map(generateChangelogLine).join("\n")
    };

    // arrange change types into categories
    logs.forEach(function(log) {

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
        prereleaseId ?
        getPrereleaseVersion(currentVersion, prereleaseId, releaseInfo.type) :
        semver.inc(currentVersion, releaseInfo.type)
    );

    return releaseInfo;
}

/**
 * Gets all changes since the last tag that represents a version.
 * @param {string} [prereleaseId] The prerelease identifier if this is a prerelease.
 * @returns {Object} An object containing all the changes since the last version.
 * @private
 */
function calculateReleaseInfo(prereleaseId) {

    // get most recent tag
    var pkg = getPackageInfo(),
        tags = getVersionTags(),
        lastTag = tags[tags.length - 1],
        commitRange = lastTag ? lastTag + "..HEAD" : "";

    // get log statements
    var logs = ShellOps.execSilent("git log --no-merges --pretty=format:\"* %H %s (%an)%n%b\" " + commitRange).split(/\n/g);
    var releaseInfo = calculateReleaseFromGitLogs(pkg.version, logs, prereleaseId);
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

    // get most recent two tags
    var now = new Date(),
        timestamp = dateformat(now, "mmmm d, yyyy");

    // output header
    ("v" + releaseInfo.version + " - " + timestamp + "\n").to("CHANGELOG.tmp");

    // output changelog
    ("\n" + releaseInfo.rawChangelog + "\n").toEnd("CHANGELOG.tmp");

    // ensure there's a CHANGELOG.md file
    if (!shelljs.test("-f", "CHANGELOG.md")) {
        fs.writeFileSync("CHANGELOG.md", "");
    }

    // switch-o change-o
    fs.writeFileSync("CHANGELOG.md.tmp", shelljs.cat("CHANGELOG.tmp", "CHANGELOG.md"));
    shelljs.rm("CHANGELOG.tmp");
    shelljs.rm("CHANGELOG.md");
    shelljs.mv("CHANGELOG.md.tmp", "CHANGELOG.md");
}

/**
 * Creates a release version tag and pushes to origin and npm.
 * @param {string} [prereleaseId] The prerelease ID (alpha, beta, rc, etc.).
 *      Only include when doing a prerelease.
 * @returns {Object} The information about the release.
 */
function generateRelease(prereleaseId) {

    validateSetup();

    console.log("Running tests");
    ShellOps.execSilent("npm test");

    console.log("Calculating changes for release");
    var releaseInfo = calculateReleaseInfo(prereleaseId);

    console.log("Release is %s", releaseInfo.version);

    console.log("Generating changelog");
    writeChangelog(releaseInfo);

    console.log("Committing to git");
    ShellOps.exec("git add CHANGELOG.md");
    ShellOps.exec("git commit -m \"Build: changelog update for " + releaseInfo.version + "\"");

    console.log("Generating %s", releaseInfo.version);
    ShellOps.execSilent("npm version " + releaseInfo.version);

    console.log("Fixing line endings");
    getPackageInfo().files.filter(function(dirPath) {
        return fs.lstatSync(dirPath).isDirectory();
    }).forEach(function(filePath) {
        if (fs.existsSync(filePath)) {
            ShellOps.execSilent("linefix " + filePath);
        }
    });

    fs.writeFileSync(".eslint-release-info.json", JSON.stringify(releaseInfo, null, 4));
}

/**
 * Publishes the release information to GitHub.
 * @param {Object} releaseInfo The release information object.
 * @returns {Promise} A promise that resolves when the operation is complete.
 * @private
 */
function publishReleaseToGitHub(releaseInfo) {

    var repoParts = releaseInfo.repository.split("/"),
        gh = new GitHub({ token: process.env.ESLINT_GITHUB_TOKEN }),
        repo = gh.getRepo(repoParts[0], repoParts[1]),
        tag = "v" + releaseInfo.version;

    return repo.createRelease({
        tag_name: tag,
        body: releaseInfo.rawChangelog,
        prerelease: !!semver.prerelease(releaseInfo.version)
    }).then(function() {
        console.log("Posted release notes to GitHub");
    }).catch(function(ex) {
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
    var releaseInfo = JSON.parse(fs.readFileSync(".eslint-release-info.json", "utf8"));

    var oldNpmrcContents;
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

    var command = "npm publish";
    if (semver.prerelease(releaseInfo.version)) {
        command += " --tag next";
    }

    if (process.env.NPM_OTP && /^\d+$/.test(process.env.NPM_OTP)) {
        command += " --otp=" + process.env.NPM_OTP;
    }

    ShellOps.exec(command);

    if (oldNpmrcContents === null) {
        fs.unlinkSync(".npmrc");
    } else {
        fs.writeFileSync(".npmrc", oldNpmrcContents);
    }

    console.log("Publishing to git");
    ShellOps.exec("git push origin master --tags");

    publishReleaseToGitHub(releaseInfo);

    return releaseInfo;
}

//------------------------------------------------------------------------------
// Public API
//------------------------------------------------------------------------------

module.exports = {
    getPrereleaseVersion: getPrereleaseVersion,
    generateRelease: generateRelease,
    publishRelease: publishRelease,
    calculateReleaseInfo: calculateReleaseInfo,
    calculateReleaseFromGitLogs: calculateReleaseFromGitLogs,
    writeChangelog: writeChangelog
};
