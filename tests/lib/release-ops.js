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

            ["2.0.0-alpha.1", "beta", "patch", "2.0.0-beta.0"]

        ], function(version, prereleaseId, releaseType, expected) {

            it("should return the correct next version", function() {
                var result = ReleaseOps.getPrereleaseVersion(version, prereleaseId, releaseType);
                assert.equal(result, expected);
            });

        });

    });

    describe("calculateReleaseFromGitLogs()", function() {

        it("should create a patch release when only bug fixes are present", function() {
            var logs = [
                    "* abcdef0 Fix: Something (Foo Bar)",
                    "* 1234567 Docs: Something else (foobar)",
                    "* a1b2c3d Fix: Something else (Foo B. Baz)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "1.0.1",
                type: "patch",
                changelog: {
                    fix: [
                        "* abcdef0 Fix: Something (Foo Bar)",
                        "* a1b2c3d Fix: Something else (Foo B. Baz)"
                    ],
                    docs: [
                        "* 1234567 Docs: Something else (foobar)"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a minor release when enhancements are present", function() {
            var logs = [
                    "* f9e8d7c Fix: Something (Author Name)",
                    "* facecab Docs: Something else (authorname)",
                    "* dec0ded Fix: Something else (First Last)",
                    "* facade5 Update: Foo (dotstar)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "1.1.0",
                type: "minor",
                changelog: {
                    fix: [
                        "* f9e8d7c Fix: Something (Author Name)",
                        "* dec0ded Fix: Something else (First Last)"
                    ],
                    docs: [
                        "* facecab Docs: Something else (authorname)"
                    ],
                    update: [
                        "* facade5 Update: Foo (dotstar)"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a major release when breaking changes are present", function() {
            var logs = [
                    "* abcd123 Fix: Something (githubhandle)",
                    "* a1b2c3d Docs: Something else (Committer Name)",
                    "* 321dcba Fix: Something else (Abc D. Efg)",
                    "* 9876543 Update: Foo (Tina Tester)",
                    "* 1234567 Breaking: Whatever (Toby Testing)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "2.0.0",
                type: "major",
                changelog: {
                    fix: [
                        "* abcd123 Fix: Something (githubhandle)",
                        "* 321dcba Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* a1b2c3d Docs: Something else (Committer Name)"
                    ],
                    update: [
                        "* 9876543 Update: Foo (Tina Tester)"
                    ],
                    breaking: [
                        "* 1234567 Breaking: Whatever (Toby Testing)"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should disregard reverted commits", function() {
            var logs = [
                    "* abcd123 Docs: Update something in the docs (githubhandle)",
                    "This is the body.",
                    "It has multiple lines.",
                    "* a1b2c3d Revert \"Breaking: A breaking change (fixes #1234)\" (Committer Name)",
                    "This reverts commit abcdef010c481d5da8d2d9b5ef74945e6566166c.",
                    "This explains why.",
                    "* 321dcba Fix: Fix a bug (fixes #4321) (Abc D. Efg)",
                    "Describe the bug.",
                    "* 9876543 Revert \"New: Add cool new feature (fixes #42)\" (Tina Tester)",
                    "This reverts commit 123456710c481d5da8d2d9b5ef74945e6566166c.",
                    "* abcdef0 Breaking: A breaking change (fixes #1234) (Cool Committer)",
                    "* 1234abc Revert \"New: From a previous release (fixes #1234)\" (Foo Bar)",
                    "This reverts commit 0123456789abcdeffedcba9876543210a1b2c3d4.",
                    "* 1234567 New: Add cool new feature (fixes #42) (Toby Testing)",
                    "Something about this change."
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepEqual(releaseInfo, {
                version: "1.0.1",
                type: "patch",
                changelog: {
                    docs: [
                        "* abcd123 Docs: Update something in the docs (githubhandle)"
                    ],
                    fix: [
                        "* 321dcba Fix: Fix a bug (fixes #4321) (Abc D. Efg)"
                    ]
                },
                rawChangelog: [
                    "* abcd123 Docs: Update something in the docs (githubhandle)",
                    "* 321dcba Fix: Fix a bug (fixes #4321) (Abc D. Efg)",
                    "* 1234abc Revert \"New: From a previous release (fixes #1234)\" (Foo Bar)"
                ].join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId", function() {
            var logs = [
                    "* abcd123 Fix: Something (githubhandle)",
                    "* a1b2c3d Docs: Something else (Committer Name)",
                    "* 321dcba Fix: Something else (Abc D. Efg)",
                    "* 9876543 Update: Foo (Tina Tester)",
                    "* 1234567 Breaking: Whatever (Cool Committer)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs, "alpha");

            assert.deepEqual(releaseInfo, {
                version: "2.0.0-alpha.0",
                type: "major",
                changelog: {
                    fix: [
                        "* abcd123 Fix: Something (githubhandle)",
                        "* 321dcba Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* a1b2c3d Docs: Something else (Committer Name)"
                    ],
                    update: [
                        "* 9876543 Update: Foo (Tina Tester)"
                    ],
                    breaking: [
                        "* 1234567 Breaking: Whatever (Cool Committer)"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId and prerelease version", function() {
            var logs = [
                    "* abcd123 Fix: Something (githubhandle)",
                    "* a1b2c3d Docs: Something else (Committer Name)",
                    "* 321dcba Fix: Something else (Abc D. Efg)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("2.0.0-alpha.0", logs, "alpha");

            assert.deepEqual(releaseInfo, {
                version: "2.0.0-alpha.1",
                type: "patch",
                changelog: {
                    fix: [
                        "* abcd123 Fix: Something (githubhandle)",
                        "* 321dcba Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* a1b2c3d Docs: Something else (Committer Name)"
                    ]
                },
                rawChangelog: logs.join("\n")
            });
        });

    });

});
