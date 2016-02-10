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
    ShellOps = require("./shell-ops"),
    nodeCLI = require("shelljs-nodecli");

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------

var OPEN_SOURCE_LICENSES = [
    /MIT/, /BSD/, /Apache/, /ISC/, /WTF/, /Public Domain/
];

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
            ShellOps.exit(1);
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
    var logs = ShellOps.execSilent("git log --no-merges --pretty=format:\"* %h %s (%an)\" " + commitRange).split(/\n/g);

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
 * @param {string} [prereleaseId] The prerelease ID (alpha, beta, rc, etc.).
 *      Only include when doing a prerelease.
 * @returns {Object} The information about the release.
 */
function release(prereleaseId) {

    validateSetup();

    console.log("Updating dependencies");
    ShellOps.execSilent("npm update && npm prune");

    console.log("Running tests");
    ShellOps.execSilent("npm test")

    console.log("Calculating changes for release");
    var releaseInfo = calculateReleaseInfo(prereleaseId);

    console.log("Release is %s", releaseInfo.version);

    console.log("Generating changelog");
    writeChangelog(releaseInfo);
    ShellOps.exec("git add .");
    ShellOps.exec("git commit -m \"Docs: Autogenerated changelog for " + releaseInfo.version + "\"");

    console.log("Generating %s", releaseInfo.version);
    ShellOps.execSilent("npm version " + releaseInfo.version);

    // push all the things
    console.log("Publishing to git");
    ShellOps.exec("git push origin master --tags");

    console.log("Publishing to npm");
    getPackageInfo().files.filter(function(dirPath) {
        return fs.lstatSync(dirPath).isDirectory();
    }).forEach(function(filePath) {
        ShellOps.execSilent("linefix " + filePath);
    });

    // if there's a prerelease ID, publish under "next" tag
    if (prereleaseId) {
        ShellOps.exec("npm publish --tag next");
    } else {
        ShellOps.exec("npm publish");
    }

    // undo any line fix differences
    ShellOps.exec("git reset");

    return releaseInfo;
}

/**
 * Creates a prerelease version tag and pushes to origin.
 * @param {string} prereleaseId The prerelease ID (alpha, beta, rc, etc.).
 * @returns {Object} The information about the release.
 */
function prerelease(prereleaseId) {

    validateSetup();

    if (!prereleaseId) {
        console.log("Missing prerelease identifier (alpha, beta, rc, etc.).");
        ShellOps.exit(1);
    }

    return release(prereleaseId);
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
