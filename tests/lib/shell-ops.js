/**
 * @fileoverview Tests for shells ops.
 * @author Nicholas C. Zakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("node:assert"),
    sinon = require("sinon"),
    path = require("path"),
    leche = require("leche"),
    ShellOps = require("../../lib/shell-ops");

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("ShellOps", () => {

    const PATH = process.env.PATH,
        NODE_MODULES_PATH = path.resolve("./node_modules/.bin");

    describe("getModifiedEnv()", () => {

        it("should modify path correctly when on Windows", () => {
            const env = ShellOps.getModifiedEnv("win32");

            assert.strictEqual(env.PATH, `${NODE_MODULES_PATH};${PATH}`);
        });

        leche.withData([
            "darwin",
            "freebsd",
            "linux",
            "sunos"
        ], platform => {
            it("should modify path correctly when on Unix OS", () => {
                const env = ShellOps.getModifiedEnv(platform);

                assert.strictEqual(env.PATH, `${NODE_MODULES_PATH}:${PATH}`);
            });
        });

    });

    describe("execSilent()", () => {

        const childProcess = require("child_process");

        const CMD = "foo bar baz",
            ENV = ShellOps.getModifiedEnv();
        let sandbox;

        beforeEach(() => {
            sandbox = sinon.sandbox.create();
        });

        afterEach(() => {
            sandbox.verifyAndRestore();
        });

        it("should call execSync with cwd and modified environment", () => {

            sandbox.mock(childProcess)
                .expects("execSync")
                .withExactArgs(CMD, {
                    cwd: process.cwd(),
                    env: ENV
                })
                .returns("");

            ShellOps.execSilent(CMD);
        });

        it("should call execSync and pass through the return value", () => {

            sandbox.stub(childProcess, "execSync").returns("hi");

            const result = ShellOps.execSilent(CMD);

            assert.strictEqual(result, "hi");
        });

        it("should call exit with an exit code when execSync throws an error", () => {

            const err = new Error("Boo!");

            err.output = [null, "Hi"];
            err.status = 2;

            sandbox.stub(childProcess, "execSync").throws(err);
            sandbox.mock(ShellOps).expects("exit").withExactArgs(err.status);
            ShellOps.execSilent(CMD);
        });

    });

    describe("exec()", () => {

        const childProcess = require("child_process");

        const CMD = "foo bar baz",
            ENV = ShellOps.getModifiedEnv();
        let sandbox;

        beforeEach(() => {
            sandbox = sinon.sandbox.create();
        });

        afterEach(() => {
            sandbox.verifyAndRestore();
        });

        it("should call execSync with cwd and modified environment", () => {

            sandbox.mock(childProcess)
                .expects("execSync")
                .withExactArgs(CMD, {
                    cwd: process.cwd(),
                    env: ENV
                })
                .returns("");

            ShellOps.exec(CMD);
        });

        it("should exit with an exit code when execSync throws an error", () => {

            const err = new Error("Boo!");

            err.output = [null, "Hi"];
            err.status = 2;

            sandbox.stub(childProcess, "execSync").throws(err);
            sandbox.mock(ShellOps).expects("exit").withExactArgs(err.status);
            ShellOps.exec(CMD);
        });

    });

});
