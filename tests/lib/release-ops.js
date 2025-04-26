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

const assert = require("assert"),
    fs = require("fs"),
    leche = require("leche"),
    os = require("os"),
    path = require("path"),
    sinon = require("sinon"),
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
                    "* 0fdda4da083887abfb7b11a3b1ed8e82c4d3d99e build: Something about b. process (baz)",
                    "* 397557b9ac860b36d3031f95c567ab8c0b12f008 chore: Something not user-facing (qux)",
                    "* a968dff397c9ea20245a11b37d93ac89a4575a03 refactor: Something better (bazqux)",
                    "* c1391a40b633315ee7b79cffad7043491f9e44f9 test: Something to cover (Baz Qux)",
                    "* c70860f01f854d6d11dd60e527d27f841d195bca ci: Something continuous (BQ)",
                    "* 3826b57a974ec1c175915fe0b9d9dd8da7e101ac perf: Something faster (quux)",
                    "* 00a3526f3a6560e4f91d390725b9a70f5d974f80 Docs: Something else (foobar)",
                    "* 24b2fdb310b89d7aad134df7e8863a5e055ac63f Fix: Something else (Foo B. Baz)",
                    "* 2a249361d032b5151489f991fae42e5bfce2d6c2 Build: Something about pkg (Baz B. Foo)",
                    "* 60eb52884c9d5a4e51001110d216959cc3974e57 Upgrade: Something about dependencies (quuux)",
                    "* 3d05dc5a07238b4134172a512b3929369ea011f8 Chore: Something different (Bar B. Qux)"
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
                    ],
                    build: [
                        "* [`0fdda4d`](https://github.com/eslint/eslint-release/commit/0fdda4da083887abfb7b11a3b1ed8e82c4d3d99e) build: Something about b. process (baz)",
                        "* [`2a24936`](https://github.com/eslint/eslint-release/commit/2a249361d032b5151489f991fae42e5bfce2d6c2) Build: Something about pkg (Baz B. Foo)"
                    ],
                    chore: [
                        "* [`397557b`](https://github.com/eslint/eslint-release/commit/397557b9ac860b36d3031f95c567ab8c0b12f008) chore: Something not user-facing (qux)",
                        "* [`a968dff`](https://github.com/eslint/eslint-release/commit/a968dff397c9ea20245a11b37d93ac89a4575a03) refactor: Something better (bazqux)",
                        "* [`c1391a4`](https://github.com/eslint/eslint-release/commit/c1391a40b633315ee7b79cffad7043491f9e44f9) test: Something to cover (Baz Qux)",
                        "* [`c70860f`](https://github.com/eslint/eslint-release/commit/c70860f01f854d6d11dd60e527d27f841d195bca) ci: Something continuous (BQ)",
                        "* [`3826b57`](https://github.com/eslint/eslint-release/commit/3826b57a974ec1c175915fe0b9d9dd8da7e101ac) perf: Something faster (quux)",
                        "* [`3d05dc5`](https://github.com/eslint/eslint-release/commit/3d05dc5a07238b4134172a512b3929369ea011f8) Chore: Something different (Bar B. Qux)"
                    ],
                    upgrade: [
                        "* [`60eb528`](https://github.com/eslint/eslint-release/commit/60eb52884c9d5a4e51001110d216959cc3974e57) Upgrade: Something about dependencies (quuux)"
                    ]
                },
                rawChangelog: [
                    "* [`5b4812a`](https://github.com/eslint/eslint-release/commit/5b4812a956935358bf6e48f4d75a9bc998b3fe41) fix: Something (Foo Bar)",
                    "* [`00b3526`](https://github.com/eslint/eslint-release/commit/00b3526f3a6560e4f91d390725b9a70f5d974f80) docs: Something else (foobar)",
                    "* [`0fdda4d`](https://github.com/eslint/eslint-release/commit/0fdda4da083887abfb7b11a3b1ed8e82c4d3d99e) build: Something about b. process (baz)",
                    "* [`397557b`](https://github.com/eslint/eslint-release/commit/397557b9ac860b36d3031f95c567ab8c0b12f008) chore: Something not user-facing (qux)",
                    "* [`a968dff`](https://github.com/eslint/eslint-release/commit/a968dff397c9ea20245a11b37d93ac89a4575a03) refactor: Something better (bazqux)",
                    "* [`c1391a4`](https://github.com/eslint/eslint-release/commit/c1391a40b633315ee7b79cffad7043491f9e44f9) test: Something to cover (Baz Qux)",
                    "* [`c70860f`](https://github.com/eslint/eslint-release/commit/c70860f01f854d6d11dd60e527d27f841d195bca) ci: Something continuous (BQ)",
                    "* [`3826b57`](https://github.com/eslint/eslint-release/commit/3826b57a974ec1c175915fe0b9d9dd8da7e101ac) perf: Something faster (quux)",
                    "* [`00a3526`](https://github.com/eslint/eslint-release/commit/00a3526f3a6560e4f91d390725b9a70f5d974f80) Docs: Something else (foobar)",
                    "* [`24b2fdb`](https://github.com/eslint/eslint-release/commit/24b2fdb310b89d7aad134df7e8863a5e055ac63f) Fix: Something else (Foo B. Baz)",
                    "* [`2a24936`](https://github.com/eslint/eslint-release/commit/2a249361d032b5151489f991fae42e5bfce2d6c2) Build: Something about pkg (Baz B. Foo)",
                    "* [`60eb528`](https://github.com/eslint/eslint-release/commit/60eb52884c9d5a4e51001110d216959cc3974e57) Upgrade: Something about dependencies (quuux)",
                    "* [`3d05dc5`](https://github.com/eslint/eslint-release/commit/3d05dc5a07238b4134172a512b3929369ea011f8) Chore: Something different (Bar B. Qux)"
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

    describe("writeChangelog", () => {

        const cwd = process.cwd();
        let sandbox = null;
        let tmpDir = null;

        beforeEach(() => {
            sandbox = sinon.sandbox.create();
            tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "writeChangelog-"));
            process.chdir(tmpDir);
        });

        afterEach(() => {
            sandbox.restore();
            sandbox = null;
            process.chdir(cwd);
            fs.readdirSync(tmpDir).forEach(filename => fs.unlinkSync(path.join(tmpDir, filename))); // delete files in tmpDir
            fs.rmdirSync(tmpDir);
            tmpDir = null;
        });

        it("creates a changelog", () => {
            const rawChangelog =
            "* [`bfb7759`](https://github.com/eslint/eeslint-release/commit/bfb7759a67daeb65410490b4d98bb9da7d1ea2ce) feat: First alpha (Firstname Lastname)";
            const releaseInfo = { version: "1.0.0-alpha.0", rawChangelog };
            const date = new Date(2024, 1, 15);

            sandbox.stub(global, "Date").returns(date);

            ReleaseOps.writeChangelog(releaseInfo);

            assert.deepStrictEqual(fs.readdirSync("."), ["CHANGELOG.md"]);
            const newChangelog = fs.readFileSync("CHANGELOG.md", "utf-8");

            assert.strictEqual(newChangelog, `v1.0.0-alpha.0 - February 15, 2024\n\n${rawChangelog}\n\n`);
        });

        it("extends a changelog", () => {
            const oldChangelog =
            "v9.0.0 - December 31, 2023\n" +
            "\n" +
            "* [`0beec7b`](https://github.com/eslint/eeslint-release/commit/0beec7b5ea3f0fdbc95d0dd47f3c5bc275da8a33) chore: Remove a dependency (𐌕𐌄𐌔𐌕)\n" +
            "\n";
            const rawChangelog =
            "* [`62cdb70`](https://github.com/eslint/eeslint-release/commit/62cdb7020ff920e5aa642c3d4066950dd1f01f4d) fix: Fix something (Abc D. Efg)\n" +
            "* [`bbe960a`](https://github.com/eslint/eeslint-release/commit/bbe960a25ea311d21d40669e93df2003ba9b90a2) test: Make sure it's broken (Francesco Trotta)";
            const releaseInfo = { version: "10.0.0", rawChangelog };
            const date = new Date(2024, 1, 2);

            sandbox.stub(global, "Date").returns(date);
            fs.writeFileSync("CHANGELOG.md", oldChangelog);

            ReleaseOps.writeChangelog(releaseInfo);

            assert.deepStrictEqual(fs.readdirSync("."), ["CHANGELOG.md"]);
            const newChangelog = fs.readFileSync("CHANGELOG.md", "utf-8");

            assert.strictEqual(newChangelog, `v10.0.0 - February 2, 2024\n\n${rawChangelog}\n\n${oldChangelog}`);
        });
    });

});
