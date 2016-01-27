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
