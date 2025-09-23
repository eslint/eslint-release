#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint-prerelease command.
 * @author Nicholas C. Zakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const ReleaseOps = require("../lib/release-ops");

//------------------------------------------------------------------------------
// Execution
//------------------------------------------------------------------------------

/*
 * Usage:
 * $ eslint-generate-prerelease beta
 */
const args = process.argv.slice(2),
    prereleaseId = (args.length ? args[0] : null);

// there must be a prerelease ID
if (!prereleaseId) {
    console.log("Missing prerelease identifier (alpha, beta, rc, etc.).");
    process.exit(1);
}

ReleaseOps.generateRelease(prereleaseId);
