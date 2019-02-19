/**
 * @fileoverview Build file
 * @author nzakas
 * @copyright jQuery Foundation and other contributors, https://jquery.org/
 * MIT License
 */

"use strict";

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path"),
    childProcess = require("child_process");

//------------------------------------------------------------------------------
// Private
//------------------------------------------------------------------------------


module.exports = {

    /**
     * Returns an environment object that has been modified to work with local
     * nod executables.
     * @param {string} [arg0] Platform identifier (same values as process.platform).
     * @param {Object} [arg1] The default environment object (mostly used for testing).
     * @returns {Object} a modified environment object.
     */
    getModifiedEnv(arg0, arg1) {

        const platform = arg0 || process.platform;
        const defaultEnv = arg1 || process.env;

        const env = {},
            pathSeparator = platform === "win32" ? ";" : ":";

        Object.keys(defaultEnv).forEach(key => {
            env[key] = defaultEnv[key];
        });

        // modify PATH to use local node_modules
        env.PATH = path.resolve(__dirname, "../node_modules/.bin") + pathSeparator + env.PATH;

        return env;
    },

    /**
     * Executes a command and returns the output instead of printing it to stdout.
     * If there's an error, then the process exits and prints out the error info.
     * @param {string} cmd The command string to execute.
     * @returns {string} The result of the executed command.
     * @private
     */
    execSilent(cmd) {
        try {
            return childProcess.execSync(cmd, {
                cwd: process.cwd(),
                env: this.getModifiedEnv()
            }).toString();
        } catch (ex) {
            console.error(ex.output[1].toString());
            this.exit(ex.status);
            return null;
        }
    },

    /**
     * Executes a command.
     * @param {string} cmd The command to execute.
     * @returns {void}
     * @throws {Error} If the command exits with a nonzero exit code.
     * @private
     */
    exec(cmd) {
        console.log(`+ ${cmd.replace(/--otp=\d+/g, "--otp=(redacted)")}`);
        const result = this.execSilent(cmd);

        console.log(result);
    },

    /**
     * Exits the process with the given code. This is just a wrapper around
     * process.exit to allow for easier stubbing and testing.
     * @param {int} code The exit code.
     * @returns {void}
     */
    exit(code) {
        process.exit(code); // eslint-disable-line no-process-exit
    }
};
