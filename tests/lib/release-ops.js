/**
 * @fileoverview Tests for release ops.
 * @author Nicholas C. Zakas
 * @copyright 2016 Nicholas C. Zakas. All rights reserved.
 * MIT License. See LICENSE in root directory for full license.
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var assert = require("chai").assert,
    leche = require("leche"),
    ReleaseOps = require("../../lib/release-ops");

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("ReleaseOps", function() {

    describe("getPrereleaseVersion()", function() {

        leche.withData([
            ["1.0.0", "alpha", "major", "2.0.0-alpha.0"],
            ["1.0.0", "alpha", "minor", "1.1.0-alpha.0"],
            ["1.0.0", "alpha", "patch", "1.0.1-alpha.0"],

            ["2.0.0-alpha.0", "alpha", "major", "2.0.0-alpha.1"],
            ["2.0.0-alpha.0", "alpha", "minor", "2.0.0-alpha.1"],
            ["2.0.0-alpha.0", "alpha", "patch", "2.0.0-alpha.1"],

            ["2.0.0-alpha.1", "beta", "patch", "2.0.0-beta.0"],

        ], function(version, prereleaseId, releaseType, expected) {

            it("should return the correct next version", function() {
                var result = ReleaseOps.getPrereleaseVersion(version, prereleaseId, releaseType);
            });

        });

    });

    describe("calculateReleaseFromGitLogs()", function() {

        it("should create a patch release when only bug fixes are present", function() {
            var logs = [
                    "Fix: Something",
                    "Docs: Something else",
                    "Fix: Something else"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "1.0.1",
                type: "patch",
                changelog: {
                    fix: [
                        "Fix: Something",
                        "Fix: Something else"
                    ],
                    docs: [
                        "Docs: Something else"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a minor release when enhancements are present", function() {
            var logs = [
                    "Fix: Something",
                    "Docs: Something else",
                    "Fix: Something else",
                    "Update: Foo"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "1.1.0",
                type: "minor",
                changelog: {
                    fix: [
                        "Fix: Something",
                        "Fix: Something else"
                    ],
                    docs: [
                        "Docs: Something else"
                    ],
                    update: [
                        "Update: Foo"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a major release when breaking changes are present", function() {
            var logs = [
                    "Fix: Something",
                    "Docs: Something else",
                    "Fix: Something else",
                    "Update: Foo",
                    "Breaking: Whatever"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "2.0.0",
                type: "major",
                changelog: {
                    fix: [
                        "Fix: Something",
                        "Fix: Something else"
                    ],
                    docs: [
                        "Docs: Something else"
                    ],
                    update: [
                        "Update: Foo"
                    ],
                    breaking: [
                        "Breaking: Whatever"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId", function() {
            var logs = [
                    "Fix: Something",
                    "Docs: Something else",
                    "Fix: Something else",
                    "Update: Foo",
                    "Breaking: Whatever"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs, "alpha");

            assert.deepEqual(releaseInfo, {
                version: "2.0.0-alpha.0",
                type: "major",
                changelog: {
                    fix: [
                        "Fix: Something",
                        "Fix: Something else"
                    ],
                    docs: [
                        "Docs: Something else"
                    ],
                    update: [
                        "Update: Foo"
                    ],
                    breaking: [
                        "Breaking: Whatever"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId and prerelease version", function() {
            var logs = [
                    "Fix: Something",
                    "Docs: Something else",
                    "Fix: Something else"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("2.0.0-alpha.0", logs, "alpha");

            assert.deepEqual(releaseInfo, {
                version: "2.0.0-alpha.1",
                type: "patch",
                changelog: {
                    fix: [
                        "Fix: Something",
                        "Fix: Something else"
                    ],
                    docs: [
                        "Docs: Something else"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

    });

});
