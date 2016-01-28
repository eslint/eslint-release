/**
 * @fileoverview Tests for shells ops.
 * @author Nicholas C. Zakas
 * @copyright 2016 Nicholas C. Zakas. All rights reserved.
 * MIT License. See LICENSE in root directory for full license.
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

var assert = require("chai").assert,
    sinon = require("sinon"),
    path = require("path"),
    leche = require("leche"),
    ShellOps = require("../../lib/shell-ops");

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("ShellOps", function() {

    var PATH = process.env.PATH,
        NODE_MODULES_PATH = path.resolve("./node_modules/.bin");

    describe("getModifiedEnv()", function() {

        it("should modify path correctly when on Windows", function() {
            var env = ShellOps.getModifiedEnv("win32");
            assert.equal(env.PATH, NODE_MODULES_PATH + ";" + PATH);
        });

        leche.withData([
            "darwin",
            "freebsd",
            "linux",
            "sunos"
        ], function(platform) {
            it("should modify path correctly when on Unix OS", function() {
                var env = ShellOps.getModifiedEnv(platform);
                assert.equal(env.PATH, NODE_MODULES_PATH + ":" + PATH);
            });
        });

    });

    describe("execSilent()", function() {

        var childProcess = require("child_process"),
            CMD = "foo bar baz",
            ENV = ShellOps.getModifiedEnv(),
            sandbox;

        beforeEach(function() {
            sandbox = sinon.sandbox.create();
        });

        afterEach(function() {
            sandbox.verifyAndRestore();
        });

        it("should call execSync with cwd and modified environment", function() {

            sandbox.mock(childProcess)
                .expects("execSync")
                .withExactArgs(CMD, {
                    cwd: process.cwd(),
                    env: ENV
                })
                .returns("");

            ShellOps.execSilent(CMD);
        });

        it("should call execSync and pass through the return value", function() {

            sandbox.stub(childProcess, "execSync").returns("hi");

            var result = ShellOps.execSilent(CMD);
            assert.equal(result, "hi");
        });

        it("should throw an error when execSync throws an error", function() {

            sandbox.stub(childProcess, "execSync").throws(new Error("Boo!"));

            assert.throws(function() {
                ShellOps.execSilent(CMD);
            }, /Boo/);
        });

    });

    describe("exec()", function() {

        var childProcess = require("child_process"),
            CMD = "foo bar baz",
            ENV = ShellOps.getModifiedEnv(),
            sandbox;

        beforeEach(function() {
            sandbox = sinon.sandbox.create();
        });

        afterEach(function() {
            sandbox.verifyAndRestore();
        });

        it("should call execSync with cwd and modified environment", function() {

            sandbox.mock(childProcess)
                .expects("execSync")
                .withExactArgs(CMD, {
                    cwd: process.cwd(),
                    env: ENV
                })
                .returns("");

            ShellOps.exec(CMD);
        });

        it("should throw an error when execSync throws an error", function() {

            sandbox.stub(childProcess, "execSync").throws(new Error("Boo!"));

            assert.throws(function() {
                ShellOps.exec(CMD);
            }, /Boo/);
        });

    });

});
