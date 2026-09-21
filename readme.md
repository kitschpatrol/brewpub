<!-- title -->

# brewpub

<!-- /title -->

<!-- badges -->

[![NPM Package brewpub](https://img.shields.io/npm/v/brewpub.svg)](https://www.npmjs.com/package/brewpub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/license/mit)
[![CI](https://github.com/kitschpatrol/brewpub/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/brewpub/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**A cli+library project.**

<!-- /short-description -->

## Overview

## Getting started

### Dependencies

### Installation

## Usage

### Library

#### API

#### Examples

### CLI

<!-- cli-help -->

#### Command: `brewpub`

Run a brewpub command.

This section lists top-level commands for `brewpub`.

If no command is provided, `brewpub do-something` is run by default.

Usage:

```txt
brewpub [command]
```

| Command             | Description                                        |
| ------------------- | -------------------------------------------------- |
| `do-something`      | Run the do-something command. _(Default command.)_ |
| `do-something-else` | Run the do-something-else command.                 |

_See the sections below for more information on each subcommand._

#### Subcommand: `brewpub do-something`

Run the do-something command.

Usage:

```txt
brewpub do-something
```

| Option              | Description              | Type      | Default |
| ------------------- | ------------------------ | --------- | ------- |
| `--verbose`         | Run with verbose logging | `boolean` | `false` |
| `--help`<br>`-h`    | Show help                | `boolean` |         |
| `--version`<br>`-v` | Show version number      | `boolean` |         |

#### Subcommand: `brewpub do-something-else`

Run the do-something-else command.

Usage:

```txt
brewpub do-something-else
```

| Option              | Description              | Type      | Default |
| ------------------- | ------------------------ | --------- | ------- |
| `--verbose`         | Run with verbose logging | `boolean` | `false` |
| `--help`<br>`-h`    | Show help                | `boolean` |         |
| `--version`<br>`-v` | Show version number      | `boolean` |         |

<!-- /cli-help -->

#### Commands

#### Examples

### Benchmarks

Run `pnpm bench` to measure the example in `test/index.bench.ts`. Run
`pnpm bench:baseline` to save or replace `test/benchmarks/baseline.json`;
subsequent `pnpm bench` runs compare against it without overwriting it.
Use a separate result file for each benchmark you add, and generate baselines
in a consistent environment. Vitest 4 benchmark JSON files must be regenerated
with Vitest 5.

## Background

### Motivation

### Implementation notes

### Similar projects

## The future

## Maintainers

_List maintainer(s) for a repository, along with one way of contacting them (e.g. GitHub link or email)._

## Acknowledgments

_State anyone or anything that significantly helped with the development of your project. State public contact hyper-links if applicable._

<!-- contributing -->

## Contributing

[Issues](https://github.com/kitschpatrol/brewpub/issues) are welcome and appreciated.

Please open an issue to discuss changes before submitting a pull request. Unsolicited PRs (especially AI-generated ones) are unlikely to be merged.

This repository uses [@kitschpatrol/shared-config](https://github.com/kitschpatrol/shared-config) (via its `ksc` CLI) for linting and formatting, plus [MDAT](https://github.com/kitschpatrol/mdat) for readme placeholder expansion.

<!-- /contributing -->

<!-- license -->

## License

[MIT](license.txt) © [Eric Mika](https://ericmika.com)

<!-- /license -->
