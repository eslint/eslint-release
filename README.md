[![NPM version][npm-image]][npm-url]
[![Downloads][downloads-image]][downloads-url]
[![Join the chat at https://gitter.im/eslint/eslint](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/eslint/eslint?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# ESLint Release Tool

This release tool has been extracted from the [ESLint](https://github.com/eslint/eslint) project so that it can be shared among projects. While it's intended for use in ESLint organization projects, it is shared freely so others might use it as well.

Please note that while this project is shared freely, it is not intended to be a general-purpose utility. The functionality is highly specific to how ESLint projects handle releases and the project will remain very focused on this use case.

**Warning:** There are minimal tests for this project and the API is rapidly changing. Use at your own risk.

## Installation

You can install the ESLint release tool using [npm](https://npmjs.com):

```
$ npm install eslint-release --save-dev
```

## Usage

To start, you'll need to define two environment variables:

* `NPM_TOKEN` - a token to use for `npm publish`. The token must be from a user that has permission to publish the package.
* `ESLINT_GITHUB_TOKEN` - a token for a GitHub user that has `repo` permission (used for posting release notes).

The ESLint release tool is designed to be used on the command line and is divided into two phases: package generation and package publishing.

To generate a regular release:

```
$ eslint-generate-release
```

To generate a prerelease, you need to include the prerelease identifier:

```
$ eslint-generate-prerelease alpha
```

Both `eslint-generate-release` and `eslint-generate-prerelease` generate a new version and update the changelog but will not push back to GitHub or publish to npm. It will generate an npm package and a `.eslint-release-info.json` file.

For both releases and prereleases, you can then publish the release:

```
$ eslint-publish-release
```

This command publishes the generate npm package and pushes the changes to GitHub. The `.eslint-release-info.json` file is required for this step to work correctly.


You can optionally include the release tool in another Node.js script:

```js
var ReleaseOps = require("eslint-release");
```

## What It Does

When you run the release tool for a regular release, the following steps take place:

1. Updates your npm packages to ensure you're running everything with the version that would be installed with a fresh install (only outside of CI release)
1. Runs `npm test` to validate the release
1. Gathers the commit message for each commit since the last release
1. Calculates the next release version based on the [commit message format](http://eslint.org/docs/developer-guide/contributing/pull-requests#step-2-make-your-changes) of the changes since the last release
1. Updates `CHANGELOG.md` and commits the changes
1. Runs `npm version` to update the version
1. Pushes the repository to origin/master with tags (only outside of CI release)
1. Converts all line endings to Unix style
1. Publishes the package to npm
1. Reverts any file changes

When you do a prerelease, the same steps are taken except that package is published to npm under the `next` tag instead of `latest`.

## Contributing

Issues and pull requests will be triaged and responded to as quickly as possible. We operate under the [ESLint Contributor Guidelines](https://eslint.org/docs/developer-guide/contributing), so please be sure to read them before contributing. If you're not sure where to dig in, check out the [issues](https://github.com/eslint/eslint-release/issues).

### License

MIT License

### Where to ask for help?

Join our [Chatroom](https://eslint.org/chat/help)

[npm-image]: https://img.shields.io/npm/v/eslint-release.svg?style=flat-square
[npm-url]: https://www.npmjs.com/package/eslint-release
[downloads-image]: https://img.shields.io/npm/dm/eslint-release.svg?style=flat-square
[downloads-url]: https://www.npmjs.com/package/eslint-release
