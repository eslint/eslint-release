#!/usr/bin/env node

/**
 * @fileoverview Main CLI that is run via the eslint-ci-release command.
 * @author Nicholas C. Zakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
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
 * $ eslint-ci-release
 */

var releaseInfo = ReleaseOps.release(null, true);
ReleaseOps.publishReleaseToGitHub(releaseInfo);
