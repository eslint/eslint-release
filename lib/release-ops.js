/**
 * @fileoverview Build file
 * @author nzakas
 * @copyright 2016 Nicholas C. Zakas. All rights reserved.
 * MIT License. See LICENSE file in root directory for full license.
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var fs = require("fs"),
    path = require("path"),
    shelljs = require("shelljs"),
    semver = require("semver"),
    execSync = require("child_process").execSync,
    checker = require("npm-license"),
    dateformat = require("dateformat"),
    nodeCLI = require("shelljs-nodecli");

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

var OPEN_SOURCE_LICENSES = [
    /MIT/, /BSD/, /Apache/, /ISC/, /WTF/, /Public Domain/
];

var env = {},
    pathSeparator = process.platform === "win32" ? ";" : ":";

Object.keys(process.env).forEach(function(key) {
    env[key] = process.env[key];
});

// modify PATH to use local node_modules
env.PATH = path.resolve(__dirname, "../node_modules/.bin") + pathSeparator + env.PATH;

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
        shelljs.exit(1);
    }

    var pkg = getPackageInfo();
    if (!pkg.files || pkg.files.length === 0) {
        console.error("Missing 'files' property in package.json");
        shelljs.exit(1);
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
 * Executes a command and returns the output instead of printing it to stdout.
 * @param {string} cmd The command string to execute.
 * @returns {string} The result of the executed command.
 * @throws {Error} If the command exits with a nonzero exit code.
 * @private
 */
function execSilent(cmd) {
    return execSync(cmd, {
        cwd: process.cwd(),
        env: env
    }).toString();
}

/**
 * Executes a command and exits if the command returns a nonzero exit code.
 * @param {string} cmd The command to execute.
 * @returns {void}
 * @throws {Error} If the command exits with a nonzero exit code.
 * @private
 */
function execOrExit(cmd) {
    var result = execSilent(cmd);
    console.log(result);
}

/**
 * Splits a command result to separate lines.
 * @param {string} result The command result string.
 * @returns {array} The separated lines.
 * @private
 */
function splitCommandResultToLines(result) {
    return result.trim().split("\n");
}

/**
 * Returns the version tags
 * @returns {string[]} Tags
 * @private
 */
function getVersionTags() {
    var tags = splitCommandResultToLines(execSilent("git tag"));

    return tags.reduce(function(list, tag) {
        if (semver.valid(tag)) {
            list.push(tag);
        }
        return list;
    }, []).sort(semver.compare);
}

/**
 * Validates the licenses of all dependencies are valid open source licenses.
 * @returns {void}
 * @private
 */
function checkLicenses() {

    /**
     * Check if a dependency is eligible to be used by us
     * @param {object} dependency dependency to check
     * @returns {boolean} true if we have permission
     * @private
     */
    function isPermissible(dependency) {
        var licenses = dependency.licenses;

        if (Array.isArray(licenses)) {
            return licenses.some(function(license) {
                return isPermissible({
                    name: dependency.name,
                    licenses: license
                });
            });
        }

        return OPEN_SOURCE_LICENSES.some(function(license) {
            return license.test(licenses);
        });
    }

    console.log("Validating licenses");

    checker.init({
        start: process.cwd()
    }, function(deps) {
        var impermissible = Object.keys(deps).map(function(dependency) {
            return {
                name: dependency,
                licenses: deps[dependency].licenses
            };
        }).filter(function(dependency) {
            return !isPermissible(dependency);
        });

        if (impermissible.length) {
            impermissible.forEach(function(dependency) {
                console.error("%s license for %s is impermissible.",
                    dependency.licenses,
                    dependency.name
                );
            });
            exit(1);
        }
    });
};

/**
 * Inspects an array of git commit log messages and calculates the release
 * information based on it.
 * @param {string[]} logs An array of log messages for the release.
 * @returns {Object} An object containing all the changes since the last version.
 * @private
 */
function calculateReleaseFromGitLogs(currentVersion, logs, prereleaseId) {

    var commitFlagPattern = /([a-z]+):/i,
        changelog = {},
        releaseInfo = {
            version: currentVersion,
            type: "",
            changelog: changelog,
            rawChangelog: logs.join("\n")
        };

    // arrange change types into categories
    logs.forEach(function(log) {
        var flag = log.match(commitFlagPattern)[1].toLowerCase();

        if (!changelog[flag]) {
            changelog[flag] = [];
        }

        changelog[flag].push(log);
    });

    if (changelog.breaking) {
        releaseInfo.type = "major";
    } else if (changelog.new || changelog.update) {
        releaseInfo.type = "minor";
    } else {
        releaseInfo.type = "patch";
    }

    // increment version from current version
    var pkg = getPackageInfo();
    releaseInfo.version = (
        prereleaseId ?
        getPrereleaseVersion(currentVersion, prereleaseId, releaseInfo.type) :
        semver.inc(currentVersion, releaseInfo.type)
    );

    return releaseInfo;
}
/**
 * Gets all changes since the last tag that represents a version.
 * @returns {Object} An object containing all the changes since the last version.
 * @private
 */
function calculateReleaseInfo(prereleaseId) {

    // get most recent tag
    var pkg = getPackageInfo(),
        tags = getVersionTags(),
        lastTag = tags[tags.length - 1],
        commitFlagPattern = /([a-z]+):/i,
        commitRange = lastTag ? lastTag + "..HEAD" : "",
        releaseInfo = {};

    // get log statements
    var logs = execSilent("git log --no-merges --pretty=format:\"* %h %s (%an)\" " + commitRange).split(/\n/g);

    return calculateReleaseFromGitLogs(pkg.version, logs, prereleaseId);
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
 * @returns {void}
 */
function release() {

    validateSetup();

    console.log("Updating dependencies");
    execOrExit("npm update && npm prune");

    console.log("Running tests");
    execOrExit("npm test")

    console.log("Calculating changes for release");
    var releaseInfo = calculateReleaseInfo();

    console.log("Release is %s", releaseInfo.version);

    console.log("Generating changelog");
    writeChangelog(releaseInfo);
    execOrExit("git add .");
    execOrExit("git commit -m \"Docs: Autogenerated changelog for " + releaseInfo.version + "\"");

    console.log("Generating %s", releaseInfo.version);
    execSilent("npm version " + releaseInfo.version);

    // push all the things
    console.log("Publishing to git");
    execOrExit("git push origin master --tags");

    console.log("Publishing to npm");
    getPackageInfo().files.filter(function(dirPath) {
        return fs.lstatSync(dirPath).isDirectory();
    }).forEach(function(filePath) {
        execSilent("linefix " + filePath);
    });
    execOrExit("npm publish");

    // undo any line fix differences
    execOrExit("git reset");
}

/**
 * Creates a prerelease version tag and pushes to origin.
 * @param {string} prereleaseId The prerelease ID (alpha, beta, rc, etc.).
 * @returns {void}
 */
function prerelease(prereleaseId) {

    // TODO: Duplicate functionality here, need to refactor

    validateSetup();

    if (!prereleaseId) {
        console.log("Missing prerelease identifier (alpha, beta, rc, etc.).");
        process.exit(1);
    }

    console.log("Updating dependencies");
    execOrExit("npm update && npm prune");

    console.log("Running tests");
    execOrExit("npm test");

    console.log("Calculating changes for release");
    var releaseInfo = calculateReleaseInfo(prereleaseId);
    console.log("Release is %s", releaseInfo.version);

    console.log("Generating changelog");
    writeChangelog(releaseInfo);
    execOrExit("git add .");
    execOrExit("git commit -m \"Docs: Autogenerated changelog for " + releaseInfo.version + "\"");

    console.log("Generating " + releaseInfo.version);
    execSilent("npm version " + version);

    // push all the things
    console.log("Publishing to git");
    execOrExit("git push origin master --tags");

    // publish to npm
    console.log("Publishing to npm");
    getPackageInfo().files.filter(function(dirPath) {
        return fs.lstatSync(dirPath).isDirectory();
    }).forEach(nodeCLI.exec.bind(nodeCLI, "linefix"));
    execOrExit("npm publish --tag next");

    // undo any line fix differences
    execOrExit("git reset");
}

//------------------------------------------------------------------------------
// Public API
//------------------------------------------------------------------------------

module.exports = {
    getPrereleaseVersion: getPrereleaseVersion,
    release: release,
    prerelease: prerelease,
    calculateReleaseInfo: calculateReleaseInfo,
    calculateReleaseFromGitLogs: calculateReleaseFromGitLogs,
    writeChangelog: writeChangelog
};
