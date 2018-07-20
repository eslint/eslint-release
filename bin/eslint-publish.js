#!/usr/bin/env node

/**
 * @fileoverview CLI to publish a package to npm after changelog and package.json have been updated
 * @author Teddy Katz
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

var ReleaseOps = require("../lib/release-ops");

ReleaseOps.publishReleaseToNpm();
