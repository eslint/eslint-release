#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint-release command.
 * @author Nicholas C. Zakas
 * @copyright 2016 Nicholas C. Zakas. All rights reserved.
 * MIT License. See LICENSE file in root directory for full license.
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var ReleaseOps = require("../lib/release-ops");

//------------------------------------------------------------------------------
// Execution
//------------------------------------------------------------------------------

/*
 * Usage for regular releases:
 * $ eslint-release
 *
 * Usage for prereleases (provide version):
 * $ eslint-release 2.0.0-beta.1
 */
var args = process.argv.slice(2),
    version = (args.length ? args[0] : null);


if (version) {
    ReleaseOps.prerelease(version);
} else {
    ReleaseOps.release();
}
