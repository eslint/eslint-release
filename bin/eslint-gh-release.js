#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint-gh-release command.
 * @author Nicholas C. Zakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var path = require("path"),
    ReleaseOps = require("../lib/release-ops");

//------------------------------------------------------------------------------
// Execution
//------------------------------------------------------------------------------

/*
 * Usage:
 * $ eslint-gh-release
 */

var releaseInfo = require(path.resolve(process.cwd(), "./.releaseInfo.json"));
ReleaseOps.publishReleaseToGitHub(releaseInfo);
