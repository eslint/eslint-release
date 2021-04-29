/**
 * @fileoverview Tests for release ops.
 * @author Nicholas C. Zakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("chai").assert,
    leche = require("leche"),
    ReleaseOps = require("../../lib/release-ops");

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("ReleaseOps", () => {

    describe("getPrereleaseVersion()", () => {

        leche.withData([
            ["1.0.0", "alpha", "major", "2.0.0-alpha.0"],
            ["1.0.0", "alpha", "minor", "1.1.0-alpha.0"],
            ["1.0.0", "alpha", "patch", "1.0.1-alpha.0"],

            ["2.0.0-alpha.0", "alpha", "major", "2.0.0-alpha.1"],
            ["2.0.0-alpha.0", "alpha", "minor", "2.0.0-alpha.1"],
            ["2.0.0-alpha.0", "alpha", "patch", "2.0.0-alpha.1"],

            ["2.0.0-alpha.1", "beta", "patch", "2.0.0-beta.0"]

        ], (version, prereleaseId, releaseType, expected) => {

            it("should return the correct next version", () => {
                const result = ReleaseOps.getPrereleaseVersion(version, prereleaseId, releaseType);

                assert.strictEqual(result, expected);
            });

        });

    });

    describe("getChangelogCommitRange", () => {

        it("returns an empty string when there are no prior releases", () => {
            const tags = [];
            const range = ReleaseOps.getChangelogCommitRange(tags);

            assert.strictEqual(range, "");
        });

        it("finds the most recent tag for normal releases", () => {
            const tags = ["1.0.0", "1.0.1"];
            const range = ReleaseOps.getChangelogCommitRange(tags);

            assert.strictEqual(range, "1.0.1..HEAD");
        });

        it("finds the most recent tag for prereleases", () => {
            const tags = ["1.0.0", "1.0.1", "2.0.0-alpha.0", "2.0.0-alpha.1"];
            const range = ReleaseOps.getChangelogCommitRange(tags, "beta");

            assert.strictEqual(range, "2.0.0-alpha.1..HEAD");
        });

        it("finds the last stable tag for a new stable following prereleases", () => {
            const tags = ["1.0.0", "1.0.1", "2.0.0-alpha.0", "2.0.0-rc.0"];
            const range = ReleaseOps.getChangelogCommitRange(tags);

            assert.strictEqual(range, "1.0.1..HEAD");
        });

    });

    describe("calculateReleaseFromGitLogs()", () => {

        it("should create a patch release when only bug fixes are present", () => {
            const logs = [
                    "* 5b4812a956935358bf6e48f4d75a9bc998b3fe41 fix: Something (Foo Bar)",
                    "* 00b3526f3a6560e4f91d390725b9a70f5d974f80 docs: Something else (foobar)",
                    "* 00a3526f3a6560e4f91d390725b9a70f5d974f80 Docs: Something else (foobar)",
                    "* 24b2fdb310b89d7aad134df7e8863a5e055ac63f Fix: Something else (Foo B. Baz)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "1.0.1",
                type: "patch",
                changelog: {
                    fix: [
                        "* [`5b4812a`](https://github.com/eslint/eslint-release/commit/5b4812a956935358bf6e48f4d75a9bc998b3fe41) fix: Something (Foo Bar)",
                        "* [`24b2fdb`](https://github.com/eslint/eslint-release/commit/24b2fdb310b89d7aad134df7e8863a5e055ac63f) Fix: Something else (Foo B. Baz)"
                    ],
                    docs: [
                        "* [`00b3526`](https://github.com/eslint/eslint-release/commit/00b3526f3a6560e4f91d390725b9a70f5d974f80) docs: Something else (foobar)",
                        "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f80) Docs: Something else (foobar)"
                    ]
                },
                rawChangelog: [
                    "* [`5b4812a`](https://github.com/eslint/eslint-release/commit/5b4812a956935358bf6e48f4d75a9bc998b3fe41) fix: Something (Foo Bar)",
                    "* [`00b3526`](https://github.com/eslint/eslint-release/commit/00b3526f3a6560e4f91d390725b9a70f5d974f80) docs: Something else (foobar)",
                    "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f80) Docs: Something else (foobar)",
                    "* [`24b2fdb`](https://github.com/eslint/eslint-release/commit/24b2fdb310b89d7aad134df7e8863a5e055ac63f) Fix: Something else (Foo B. Baz)"
                ].join("\n")
            });
        });

        it("should create a minor release when enhancements are present", () => {
            const logs = [
                    "* 34d6f550b2c87e61a70cb201abd3eadebb370453 Fix: Something (Author Name)",
                    "* 5c5c361cc338d284cac6d170ab7e105e213e1307 Docs: Something else (authorname)",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e48 Fix: Something else (First Last)",
                    "* 7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758 Update: Foo (dotstar)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "1.1.0",
                type: "minor",
                changelog: {
                    fix: [
                        "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Fix: Something (Author Name)",
                        "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Something else (First Last)"
                    ],
                    docs: [
                        "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) Docs: Something else (authorname)"
                    ],
                    update: [
                        "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) Update: Foo (dotstar)"
                    ]
                },
                rawChangelog: [
                    "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Fix: Something (Author Name)",
                    "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) Docs: Something else (authorname)",
                    "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Something else (First Last)",
                    "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) Update: Foo (dotstar)"
                ].join("\n")
            });
        });

        it("should create a minor release when conventional enhancements are present", () => {
            const logs = [
                    "* 34d6f550b2c87e61a70cb201abd3eadebb370453 fix: Something (Author Name)",
                    "* 5c5c361cc338d284cac6d170ab7e105e213e1307 docs: Something else (authorname)",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e48 fix: Something else (First Last)",
                    "* 7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758 feat: Foo (dotstar)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "1.1.0",
                type: "minor",
                changelog: {
                    fix: [
                        "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) fix: Something (Author Name)",
                        "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) fix: Something else (First Last)"
                    ],
                    docs: [
                        "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) docs: Something else (authorname)"
                    ],
                    new: [
                        "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) feat: Foo (dotstar)"
                    ]
                },
                rawChangelog: [
                    "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) fix: Something (Author Name)",
                    "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) docs: Something else (authorname)",
                    "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) fix: Something else (First Last)",
                    "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) feat: Foo (dotstar)"
                ].join("\n")
            });
        });

        it("should create a major release when breaking changes are present", () => {
            const logs = [
                    "* 34d6f550b2c87e61a70cb201abd3eadebb370453 Fix: Something (githubhandle)",
                    "* 5c5c361cc338d284cac6d170ab7e105e213e1307 Docs: Something else (Committer Name)",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e48 Fix: Something else (Abc D. Efg)",
                    "* 7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758 Update: Foo (Tina Tester)",
                    "* 00a3526f3a6560e4f91d390725b9a70f5d974f89 Breaking: Whatever (Toby Testing)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "2.0.0",
                type: "major",
                changelog: {
                    fix: [
                        "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Fix: Something (githubhandle)",
                        "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) Docs: Something else (Committer Name)"
                    ],
                    update: [
                        "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) Update: Foo (Tina Tester)"
                    ],
                    breaking: [
                        "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f89) Breaking: Whatever (Toby Testing)"
                    ]
                },
                rawChangelog: [
                    "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Fix: Something (githubhandle)",
                    "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) Docs: Something else (Committer Name)",
                    "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Something else (Abc D. Efg)",
                    "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) Update: Foo (Tina Tester)",
                    "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f89) Breaking: Whatever (Toby Testing)"
                ].join("\n")
            });
        });

        it("should create a major release when conventional breaking changes are present", () => {
            const logs = [
                    "* 34d6f550b2c87e61a70cb201abd3eadebb370453 fix: Something (githubhandle)",
                    "* 5c5c361cc338d284cac6d170ab7e105e213e1307 docs: Something else (Committer Name)",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e48 fix: Something else (Abc D. Efg)",
                    "* 7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758 feat: Foo (Tina Tester)",
                    "* 00a3526f3a6560e4f91d390725b9a70f5d974f89 feat!: Whatever (Toby Testing)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "2.0.0",
                type: "major",
                changelog: {
                    fix: [
                        "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) fix: Something (githubhandle)",
                        "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) docs: Something else (Committer Name)"
                    ],
                    new: [
                        "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) feat: Foo (Tina Tester)"
                    ],
                    breaking: [
                        "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f89) feat!: Whatever (Toby Testing)"
                    ]
                },
                rawChangelog: [
                    "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) fix: Something (githubhandle)",
                    "* [`5c5c361`](https://github.com/eslint/eslint-release/commit/5c5c361cc338d284cac6d170ab7e105e213e1307) docs: Something else (Committer Name)",
                    "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) fix: Something else (Abc D. Efg)",
                    "* [`7e4ffad`](https://github.com/eslint/eslint-release/commit/7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758) feat: Foo (Tina Tester)",
                    "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f89) feat!: Whatever (Toby Testing)"
                ].join("\n")
            });
        });

        it("should disregard reverted commits and sponsor syncs", () => {
            const logs = [
                    "* 34d6f550b2c87e61a70cb201abd3eadebb370453 Docs: Update something in the docs (githubhandle)",
                    "This is the body.",
                    "It has multiple lines.",
                    "* 5c5c361cc338d284cac6d170ab7e105e213e1307 Revert \"Breaking: A breaking change (fixes #1234)\" (Committer Name)",
                    "This reverts commit 00a3526f3a6560e4f91d390725b9a70f5d974f89.",
                    "This explains why.",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e4a Sponsors: Sync README with website (Abc D. Efg)",
                    "Describe the bug.",
                    "* bcdc618488d12184e32a7ba170b443450c3e9e48 Fix: Fix a bug (fixes #4321) (Abc D. Efg)",
                    "Describe the bug.",
                    "* 7e4ffad5c91e4f8a99a95955ec65c5dbe9ae1758 Revert \"New: Add cool new feature (fixes #42)\" (Tina Tester)",
                    "This reverts commit 6465ce531d607e7f146e56317b9273d0488e0f46.",
                    "* 00a3526f3a6560e4f91d390725b9a70f5d974f89 Breaking: A breaking change (fixes #1234) (Cool Committer)",
                    "* 4a0d181ebff8d380b7e250a5519626222add8aaa Revert \"New: From a previous release (fixes #1234)\" (Foo Bar)",
                    "This reverts commit 0123456789abcdeffedcba9876543210a1b2c3d4.",
                    "* 6465ce531d607e7f146e56317b9273d0488e0f46 New: Add cool new feature (fixes #42) (Toby Testing)",
                    "Something about this change."
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "1.0.1",
                type: "patch",
                changelog: {
                    docs: [
                        "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Docs: Update something in the docs (githubhandle)"
                    ],
                    fix: [
                        "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Fix a bug (fixes #4321) (Abc D. Efg)"
                    ]
                },
                rawChangelog: [
                    "* [`34d6f55`](https://github.com/eslint/eslint-release/commit/34d6f550b2c87e61a70cb201abd3eadebb370453) Docs: Update something in the docs (githubhandle)",
                    "* [`bcdc618`](https://github.com/eslint/eslint-release/commit/bcdc618488d12184e32a7ba170b443450c3e9e48) Fix: Fix a bug (fixes #4321) (Abc D. Efg)",
                    "* [`4a0d181`](https://github.com/eslint/eslint-release/commit/4a0d181ebff8d380b7e250a5519626222add8aaa) Revert \"New: From a previous release (fixes #1234)\" (Foo Bar)"
                ].join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId", () => {
            const logs = [
                    "* fbe463916e0b49bc55f37363bf577ee20e0b3da6 Fix: Something (githubhandle)",
                    "* 7de216285f4d2e96508e6faefd9d8357baaaaec0 Docs: Something else (Committer Name)",
                    "* cd06fd502d106d10821227fd2d2ff77f7332c100 Fix: Something else (Abc D. Efg)",
                    "* 7413ef1a8f5ddca092a1afbd06559b826f7956d3 Update: Foo (Tina Tester)",
                    "* 7e8a43b2b6350e13a61858f33b4099c964cdd758 Breaking: Whatever (Cool Committer)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("1.0.0", logs, "alpha");

            assert.deepStrictEqual(releaseInfo, {
                version: "2.0.0-alpha.0",
                type: "major",
                changelog: {
                    fix: [
                        "* [`fbe4639`](https://github.com/eslint/eslint-release/commit/fbe463916e0b49bc55f37363bf577ee20e0b3da6) Fix: Something (githubhandle)",
                        "* [`cd06fd5`](https://github.com/eslint/eslint-release/commit/cd06fd502d106d10821227fd2d2ff77f7332c100) Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`7de2162`](https://github.com/eslint/eslint-release/commit/7de216285f4d2e96508e6faefd9d8357baaaaec0) Docs: Something else (Committer Name)"
                    ],
                    update: [
                        "* [`7413ef1`](https://github.com/eslint/eslint-release/commit/7413ef1a8f5ddca092a1afbd06559b826f7956d3) Update: Foo (Tina Tester)"
                    ],
                    breaking: [
                        "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Whatever (Cool Committer)"
                    ]
                },
                rawChangelog: [
                    "* [`fbe4639`](https://github.com/eslint/eslint-release/commit/fbe463916e0b49bc55f37363bf577ee20e0b3da6) Fix: Something (githubhandle)",
                    "* [`7de2162`](https://github.com/eslint/eslint-release/commit/7de216285f4d2e96508e6faefd9d8357baaaaec0) Docs: Something else (Committer Name)",
                    "* [`cd06fd5`](https://github.com/eslint/eslint-release/commit/cd06fd502d106d10821227fd2d2ff77f7332c100) Fix: Something else (Abc D. Efg)",
                    "* [`7413ef1`](https://github.com/eslint/eslint-release/commit/7413ef1a8f5ddca092a1afbd06559b826f7956d3) Update: Foo (Tina Tester)",
                    "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Whatever (Cool Committer)"
                ].join("\n")
            });
        });

        it("should create a prerelease when passed a prereleaseId and prerelease version", () => {
            const logs = [
                    "* eda81fc28943d51377851295c5c09682496fb9ac Fix: Something (githubhandle)",
                    "* 0c07d6ac037076557e34d569cd0290e529b3318a Docs: Something else (Committer Name)",
                    "* 196d32dbfb7cb37b886e7c4ba0adff499c6b26ac Fix: Something else (Abc D. Efg)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("2.0.0-alpha.0", logs, "alpha");

            assert.deepStrictEqual(releaseInfo, {
                version: "2.0.0-alpha.1",
                type: "patch",
                changelog: {
                    fix: [
                        "* [`eda81fc`](https://github.com/eslint/eslint-release/commit/eda81fc28943d51377851295c5c09682496fb9ac) Fix: Something (githubhandle)",
                        "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)"
                    ]
                },
                rawChangelog: [
                    "* [`eda81fc`](https://github.com/eslint/eslint-release/commit/eda81fc28943d51377851295c5c09682496fb9ac) Fix: Something (githubhandle)",
                    "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)",
                    "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)"
                ].join("\n")
            });
        });

        it("should create the next stable release following a prerelease", () => {
            const logs = [
                    "* 7e8a43b2b6350e13a61858f33b4099c964cdd758 Breaking: Remove API (githubhandle)",
                    "* 0c07d6ac037076557e34d569cd0290e529b3318a Docs: Something else (Committer Name)",
                    "* 196d32dbfb7cb37b886e7c4ba0adff499c6b26ac Fix: Something else (Abc D. Efg)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("2.0.0-rc.0", logs);

            assert.deepStrictEqual(releaseInfo, {
                version: "2.0.0",
                type: "major",
                changelog: {
                    fix: [
                        "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)"
                    ],
                    breaking: [
                        "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Remove API (githubhandle)"
                    ]
                },
                rawChangelog: [
                    "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Remove API (githubhandle)",
                    "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)",
                    "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)"
                ].join("\n")
            });
        });

        it("should gracefully handle unformatted commit messages", () => {
            const logs = [
                    "* 70222e95932d3a391ac5717252e13b478d686ba9 0.4.0-alpha.4 (Nicholas C. Zakas)",
                    "* d52a55e0572fbef1b702abfeefab9f53ff36d121 Build: package.json and changelog update for 0.4.0-alpha.4 (Nicholas C. Zakas)",
                    "* 1934e59323448afd864acc1db712ef8ef730af1a Fix: Changelog output (Nicholas C. Zakas)"
                ],
                releaseInfo = ReleaseOps.calculateReleaseFromGitLogs("0.4.0-alpha.4", logs, "alpha");

            assert.deepStrictEqual(releaseInfo, {
                version: "0.4.0-alpha.5",
                type: "patch",
                changelog: {
                    build: [
                        "* [`d52a55e`](https://github.com/eslint/eslint-release/commit/d52a55e0572fbef1b702abfeefab9f53ff36d121) Build: package.json and changelog update for 0.4.0-alpha.4 (Nicholas C. Zakas)"
                    ],
                    fix: [
                        "* [`1934e59`](https://github.com/eslint/eslint-release/commit/1934e59323448afd864acc1db712ef8ef730af1a) Fix: Changelog output (Nicholas C. Zakas)"
                    ]
                },
                rawChangelog: [
                    "* [`70222e9`](https://github.com/eslint/eslint-release/commit/70222e95932d3a391ac5717252e13b478d686ba9) 0.4.0-alpha.4 (Nicholas C. Zakas)",
                    "* [`d52a55e`](https://github.com/eslint/eslint-release/commit/d52a55e0572fbef1b702abfeefab9f53ff36d121) Build: package.json and changelog update for 0.4.0-alpha.4 (Nicholas C. Zakas)",
                    "* [`1934e59`](https://github.com/eslint/eslint-release/commit/1934e59323448afd864acc1db712ef8ef730af1a) Fix: Changelog output (Nicholas C. Zakas)"
                ].join("\n")
            });
        });
    });

    describe("generateReleaseBody()", () => {
        it("generates a changelog grouped by types", () => {
            const changelog = {
                    fix: [
                        "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)"
                    ],
                    docs: [
                        "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)"
                    ],
                    breaking: [
                        "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Remove API (githubhandle)"
                    ]
                },
                generateReleaseBody = ReleaseOps.generateReleaseBody;

            assert.strictEqual(generateReleaseBody(changelog), [
                "## Breaking Changes",
                "* [`7e8a43b`](https://github.com/eslint/eslint-release/commit/7e8a43b2b6350e13a61858f33b4099c964cdd758) Breaking: Remove API (githubhandle)",
                "",
                "## Bug Fixes",
                "* [`196d32d`](https://github.com/eslint/eslint-release/commit/196d32dbfb7cb37b886e7c4ba0adff499c6b26ac) Fix: Something else (Abc D. Efg)",
                "",
                "## Documentation",
                "* [`0c07d6a`](https://github.com/eslint/eslint-release/commit/0c07d6ac037076557e34d569cd0290e529b3318a) Docs: Something else (Committer Name)"
            ].join("\n"));
        });
    });

});
