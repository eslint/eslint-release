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
