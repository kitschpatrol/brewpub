<!-- title -->

# brewpub

<!-- /title -->

<!-- badges -->

[![NPM Package brewpub](https://img.shields.io/npm/v/brewpub.svg)](https://www.npmjs.com/package/brewpub)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/license/mit)
[![CI](https://github.com/kitschpatrol/brewpub/actions/workflows/ci.yml/badge.svg)](https://github.com/kitschpatrol/brewpub/actions/workflows/ci.yml)

<!-- /badges -->

<!-- short-description -->

**CLI tool to publish and update Homebrew formula to your custom tap. Like npm publish for Homebrew.**

<!-- /short-description -->

## Overview

Brewpub simplifies publishing CLI package formula into your [Homebrew](https://brew.sh) tap.

The current implementation is focused on mirroring npm packages with `bin` fields to Homebrew, and requires your custom tap repository to be hosted on GitHub. Future versions might expand support to additional project types and git situations.

You can integrate it in your CI release workflow, or just run it right after `npm publish` from your project directory and it will:

1. Read the package name and version from your local `package.json`, using [metascope](https://github.com/kitschpatrol/metascope).
2. Wait for the npm registry to serve that exact version, download the tarball, verify it against the registry's integrity data, and compute the SHA-256 that Homebrew needs.
3. Create a formula in the shape of `brew create --node`, or update the existing formula's `url` and `sha256` lines in place.
4. Commit the change straight to your tap on GitHub, or open a pull request with `--pr`.

It works entirely through the GitHub API, so it needs no local clone of your tap, no `git`, and no `brew`.

## Getting started

### Dependencies

- Node 24 or newer.
- A GitHub token with write access to the tap repository. Brewpub looks for `--token`, then the `BREWPUB_TOKEN` and `GITHUB_TOKEN` environment variables, then `gh auth token` if the [GitHub CLI](https://cli.github.com) is installed and signed in.
- A GitHub-hosted tap repository, conventionally named `homebrew-<name>`. Create one with `brew tap-new <owner>/<name>` if you don't have one yet.

### Installation

Run it without installing anything:

```sh
pnpx brewpub --tap kitschpatrol/tap
```

Or add it to a project so it can run as part of your release script or to access the TypeScript API:

```sh
pnpm add -D brewpub
```

Or, since brewpub uses itself to publish itself to Homebrew, you can install it accordingly:

```sh
brew install kitschpatrol/tap/brewpub
```

## Usage

### CLI

The common case is a single command in your release script, after publishing:

```sh
pnpm publish && brewpub --tap kitschpatrol/tap
```

Every option can also be set as an environment variable prefixed with `BREWPUB_`, so a CI job can set `BREWPUB_TAP` and `BREWPUB_TOKEN` once and run a bare `brewpub`.

Preview the formula without writing anything:

```sh
brewpub --tap kitschpatrol/tap --dry-run
```

Open a pull request instead of committing to the default branch, and put new formulae in a subdirectory:

```sh
brewpub --tap kitschpatrol/tap --pr --path Formula/custom
```

Existing formulae are found anywhere under the tap's `Formula` directory and updated in place, so `--path` only affects where new formulae go.

Packages with several `bin` entries get all of them installed, and the first is used in the formula's test block. Pass `--bin` to install and test just one of them:

```sh
brewpub --tap kitschpatrol/tap --bin tldraw-cli
```

<!-- cli-help -->

#### Command: `brewpub`

Create or update a Homebrew formula for a published npm package in a GitHub-hosted tap. Run it after `npm publish`.

Usage:

```txt
brewpub
```

| Option              | Description                                                                                                                                                      | Type      | Default                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------------------------------ |
| `--verbose`         | Enable verbose logging.                                                                                                                                          | `boolean` | `false`                        |
| `--tap`             | GitHub repository of the Homebrew tap, as "owner/name" or "owner/homebrew-name". For example, "kitschpatrol/tap".                                                | `string`  |                                |
| `--cwd`             | Directory of the npm package to publish as a formula. Defaults to the current directory.                                                                         | `string`  | `"."`                          |
| `--path`            | Directory inside the tap where new formulae are written, for example "Formula/custom". Existing formulae are updated wherever they already live under "Formula". | `string`  | `"Formula"`                    |
| `--name`            | Formula name. Defaults to the package name without its scope.                                                                                                    | `string`  |                                |
| `--bin`             | The only executable the formula installs and tests, for packages with several "bin" entries. By default all entries are installed and the first is tested.       | `string`  |                                |
| `--description`     | Formula description. Defaults to the package description, adjusted to satisfy `brew audit`.                                                                      | `string`  |                                |
| `--token`           | GitHub token with write access to the tap. Defaults to BREWPUB\_TOKEN, then GITHUB\_TOKEN, then `gh auth token`.                                                 | `string`  |                                |
| `--pr`              | Open a pull request instead of committing directly to the base branch.                                                                                           | `boolean` | `false`                        |
| `--branch`          | Base branch in the tap. Defaults to the repository's default branch.                                                                                             | `string`  |                                |
| `--force`           | Allow downgrading to an older version, and reuse an existing pull request branch.                                                                                | `boolean` | `false`                        |
| `--dry-run`         | Resolve the package and print the formula without writing to the tap. Registry and tap reads still happen.                                                       | `boolean` | `false`                        |
| `--json`            | Print the result as JSON on stdout.                                                                                                                              | `boolean` | `false`                        |
| `--registry`        | npm registry to resolve the package from.                                                                                                                        | `string`  | `"https://registry.npmjs.org"` |
| `--timeout`         | Seconds to wait for the registry to serve the published version.                                                                                                 | `number`  | `600`                          |
| `--help`<br>`-h`    | Show help                                                                                                                                                        | `boolean` |                                |
| `--version`<br>`-v` | Show version number                                                                                                                                              | `boolean` |                                |

<!-- /cli-help -->

#### Examples

Get a machine-readable result for further automation:

```sh
brewpub --tap kitschpatrol/tap --json | jq .commit.url
```

Use it in a GitHub Actions release workflow. The default `GITHUB_TOKEN` can't write to a different repository, so store a personal access token with `contents` write permission on the tap as a secret:

```yaml
- run: pnpm publish
  env:
    NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
- run: npx brewpub --tap kitschpatrol/tap
  env:
    BREWPUB_TOKEN: ${{ secrets.TAP_TOKEN }}
```

### Library

Brewpub's NPM package also exports a TypeScript library exposing the same operation as the CLI plus the building blocks it's made from, so you can compose them in your own release tooling.

#### API

- `publishFormula(options)` runs the whole flow and returns a `PublishFormulaResult` describing what happened: the action taken (`created`, `updated`, or `unchanged`), the formula source, the resolved package release, and the commit or pull request that was created.
- `getPackageRelease(name, version, options)` polls the registry for a version, downloads and verifies the tarball, and returns its URL and SHA-256.
- `renderFormula(input)` renders a new Node formula.
- `updateFormula(existingRuby, { url, sha256 })` replaces only the top-level `url` and `sha256` stanzas of an existing formula.
- `normalizeDescription(text, options)` rewrites a package description so it passes Homebrew's `desc` audit rules.
- `getFormulaName(packageName)`, `getFormulaClassName(formulaName)`, `parseTapName(tap)`, `normalizeRepoUrl(url)`, and `resolveGitHubToken()` are the smaller helpers behind the above.
- `setLogger(logger)` routes the library's log output to your own logger.

All exported functions and types have JSDoc comments; see `dist/lib/index.d.ts` for the full surface.

#### Examples

```ts
import { publishFormula } from 'brewpub'

const result = await publishFormula({
  cwd: '.',
  path: 'Formula/custom',
  tap: 'kitschpatrol/tap',
})

console.log(`${result.action} ${result.formula.path}`)
```

Render a formula without touching GitHub:

```ts
import { getPackageRelease, renderFormula } from 'brewpub'

const release = await getPackageRelease('mdat', '3.2.1')

const formula = renderFormula({
  binName: release.binNames[0]!,
  description: 'Markdown autophagic template',
  formulaName: 'mdat',
  homepage: release.homepage!,
  license: release.license,
  sha256: release.sha256,
  url: release.tarballUrl,
})
```

## Background

### Motivation

Publishing a CLI to npm is one command. Making it installable with `brew install` means maintaining a second repository and, for every release, computing a hash and editing a Ruby file. Homebrew's maintainers have [declined](https://github.com/Homebrew/brew/issues/14198) to add a `brew publish` step, so brewpub provides the missing half of the workflow for npm packages. Future version might cover additional project and formula types, and possibly casks as well.

### Implementation notes

#### Registry timing

`npm publish` returns once the registry accepts the upload, but the package metadata can take a little while to become readable, and the registry only publishes SHA-1 and SHA-512 checksums while Homebrew wants SHA-256. Brewpub asks the registry for the exact version immediately, retries with backoff if it isn't there yet (up to `--timeout`, ten minutes by default), downloads the tarball from the URL the registry reports, checks it against the registry's SHA-512 integrity value, and only then computes the SHA-256. Since Homebrew downloads the same URL, the hash in the formula always matches.

#### Surgical updates

When a formula already exists, only its top-level `url` and `sha256` lines change. Everything else, including `bottle` blocks added by `brew pr-pull`, `livecheck` blocks, extra dependencies, and hand-written tests, is left alone. This mirrors what `brew bump-formula-pr` does.

#### Platform constraints

The `os` and `cpu` fields of the local `package.json` become `depends_on` stanzas: `["darwin"]` gives `depends_on :macos`, `["linux"]` gives `depends_on :linux`, and `["arm64"]` or `["x64"]` give `depends_on arch: :arm64` or `:x86_64`. Lists that allow both of Homebrew's platforms, and exclusions like `["!win32"]` that don't narrow them, produce no stanza. This only applies when a formula is created; updates leave existing `depends_on` lines alone.

#### Livecheck for free

Homebrew's built-in npm livecheck strategy recognizes registry tarball URLs, so formulae created by brewpub work with `brew livecheck` and `brew bump` without a `livecheck` block.

#### Description rules

Homebrew's `brew audit` rejects descriptions that start with an article or the formula name, end with a period, spell "command-line" differently, contain emoji, or exceed 80 characters. Brewpub fixes the first few automatically, drops leading boilerplate like "CLI tool to" or "CLI tool and TypeScript library for", keeps only the first sentence, and warns about length, which `--description` can override.

#### Dependency cooldown

When Homebrew builds a Node formula it installs dependencies with npm's `--min-release-age=1`, so a build can fail if any dependency was published in the last 24 hours. This is a Homebrew policy, not something brewpub can work around, but it's worth knowing if a tap CI run fails right after a release.

#### Tokens

A token passed on the command line is visible to other processes and in shell history, so prefer the environment variables when running locally. CI runners mask secrets either way.

### Similar projects

- [`brew bump-formula-pr`](https://docs.brew.sh/Manpage#bump-formula-pr-options-formula) updates an existing formula's version and hash and opens a PR, but requires Homebrew and a local tap checkout, and can't create formulae.
- [dawidd6/action-homebrew-bump-formula](https://github.com/dawidd6/action-homebrew-bump-formula) wraps `brew bump-formula-pr` for GitHub Actions.
- [aicw-io/homebrew-tap](https://github.com/aicw-io/homebrew-tap) is an example of a tap that mirrors npm packages by hand.
- [`@auto-it/brew`](https://www.npmjs.com/package/@auto-it/brew), a plugin for [intuit/auto](https://github.com/intuit/auto), fills a formula template you write yourself with the version and SHA-256 of a prebuilt executable attached to a GitHub release, and commits it as part of auto's release flow. It suits compiled binaries and projects already using auto for releases. Brewpub instead targets the npm tarball, needs no template, updates an existing formula in place, and runs as a single step after any publish tool.

## The future

- Templates for other ecosystems, such as PyPI or Rust. The formula renderer is isolated so a second one can slot in.
- Publishing a package that isn't in the current directory, for mirroring third-party CLIs.

## Maintainers

[@kitschpatrol](https://github.com/kitschpatrol)

## Acknowledgments

The generated formula follows the template produced by `brew create --node`, and the description normalization follows the rules in Homebrew's `desc` audit.

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
