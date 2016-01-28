#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint-prerelease command.
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
 * Usage:
 * $ eslint-prerelease beta
 */
var args = process.argv.slice(2),
    prereleaseId = (args.length ? args[0] : null);

// there must be a prerelease ID
if (!prereleaseId) {
    console.log("Missing prerelease identifier (alpha, beta, rc, etc.).");
    process.exit(1);
}

ReleaseOps.prerelease(prereleaseId);
