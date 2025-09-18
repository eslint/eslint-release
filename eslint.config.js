"use strict";

const { defineConfig } = require("eslint/config");
const eslintConfigESLint = require("eslint-config-eslint/cjs");
const globals = require("globals");

module.exports = defineConfig([
    eslintConfigESLint,
    {
        files: ["lib/**/*.js", "bin/**/*.js"],
        rules: {
            "no-console": "off",
            "require-unicode-regexp": "off",
            "regexp/optimal-quantifier-concatenation": "off",
            "n/no-process-exit": "off",
            "n/no-unsupported-features/es-syntax": "off",
            "unicorn/prefer-at": "off", // `Array.prototype.at` is supported in Node.js 16.6+
        },
    },
    {
        files: ["tests/**/*.js"],
        languageOptions: {
            globals: {
                ...globals.mocha
            }
        }
    }
]);
