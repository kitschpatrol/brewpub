# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Maintenance

- Stop reading and injecting `NPM_TOKEN` from 1Password in the release script.

## [0.5.1] - 2026-11-01

### Fixed

- Update `lognow` to `^0.8.7` so injected custom loggers fall back to `debug` when their `trace` method is missing or undefined.

### Maintenance

- Update the `metascope` runtime requirement from `^0.12.1` to `^0.13.8`.
- Refresh development dependencies and pnpm to 12.16.1, including shared-config 8.14, tsdown, Vitest, MSW, and CLI-help tooling.
- Refresh contributor configuration with build-before-lint/fix checks, pnpm-managed shared-config skills, ESLint 10 peer compatibility, restored repository-link validation, and removal of stale release-age exemptions.
- Add a monthly and manually triggered workflow that runs dependency maintenance and opens pull requests.
- Refresh CI and release actions, and make link checks ignore loopback URLs and tolerate empty input.

## [0.5.0] - 2026-10-04

### Changed

- **Breaking:** Rename the public `normalizeRepoUrl` export to `normalizeRepositoryUrl`, removing the old export name.
- **Breaking:** Require `next.description` in `updateFormula` and an existing top-level, double-quoted `desc` stanza in the formula being updated.

### Fixed

- Refresh existing formula descriptions from normalized package metadata or `--description`, even when the URL and checksum are unchanged, with proper Ruby string escaping.

### Documentation

- Revise installation guidance for npx, global npm/Homebrew, and local library use, and correct the documented Node.js requirement to `^24.16.0 || >=26.3.0`.
- Update CLI help and API guidance for description synchronization, including that publishing overwrites hand-edited formula descriptions, and document the renamed repository URL helper.

### Maintenance

- Refresh declared runtime dependencies, including `metascope ^0.12.1`, `uint8array-extras ^1.6.0`, and Node.js typings.
- Refresh development tooling and pnpm to 12.7.0, including shared-config 8.11, updated test/build validation tools, and migration of request mocking to MSW 3.
- Correct stderr capture during sitemap discovery in the link-check workflow.

## [0.4.0] - 2026-09-21

### Added

- Add `--bin` and `publishFormula`'s `bin` option to install and test one declared executable in newly created formulae, with validation and corresponding `renderFormula` support through `binOnly`.

### Documentation

- Document multi-executable installation defaults and single-executable selection with `--bin`, including CLI help and an example.

## [0.3.1] - 2026-09-21

### Added

- Make the CLI available through Homebrew with `brew install kitschpatrol/tap/brewpub`.

### Documentation

- Document Homebrew installation and clarify that installing a project dependency provides both the CLI and TypeScript API.
- Add a comparison with `@auto-it/brew`, explaining its template-based GitHub binary workflow versus brewpub's npm tarball workflow.

### Maintenance

- Refresh shared contributor configuration to `^8.10.0` and update dependency release-age exemptions.
- Add brewpub as a development dependency and automatically update its Homebrew formula after npm publication.

## [0.3.0] - 2026-09-21

### Added

- Translate local `package.json` OS and CPU restrictions into new formulae's `depends_on` constraints, handling allowlists and exclusions and warning when no Homebrew-supported platform or architecture is allowed.
- Export `getPlatformRequirements` and `PlatformRequirements`, and add optional `os` and `arch` inputs to `renderFormula`.

### Changed

- **Breaking:** Add required `cpu` and `os` arrays to the exported `LocalPackageInfo` type, populated from the local manifest; callers constructing this type must supply both fields.
- Increase the default registry wait from five to ten minutes for the CLI, `publishFormula`, and `getPackageRelease`.

### Documentation

- Explain OS/CPU constraint mapping and clarify that platform dependencies are generated only when creating formulae.
- Update generated CLI help and registry-timing guidance for the ten-minute default timeout.

### Maintenance

- Update the `lognow` runtime requirement to `^0.8.4`.

## [0.2.0] - 2026-09-21

### Changed

- Strip leading description boilerplate such as “CLI tool to” and retain only the first sentence, while preserving embedded periods in text such as `Node.js` and `e.g. foo`.

### Documentation

- Document boilerplate removal and first-sentence selection in the description-normalization guidance.

## [0.1.0] - 2026-09-21

### Added

- Provide an npm-distributed `brewpub` executable and typed ESM library requiring Node.js `^24.16.0 || >=26.3.0`.
- Publish local npm CLI packages to GitHub-hosted Homebrew taps through direct commits or `--pr` pull requests, without a local tap checkout, Git, or Homebrew.
- Wait up to five minutes by default for exact npm versions, retry registry and tarball requests, verify available integrity data, and compute Homebrew SHA-256 checksums.
- Generate Node formulae that install package executables and test `--version`, with Homebrew description normalization, homepage fallbacks, and optional SPDX license metadata.
- Discover existing formulae under nested `Formula/` directories and update only top-level `url` and `sha256` stanzas, preserving custom Ruby while skipping unchanged formulae and rejecting duplicates or unforced downgrades.
- Configure package location with `--cwd`, formula paths and metadata, base branches, registries, timeouts, and forced downgrades or PR branch reuse through flags or `BREWPUB_` environment variables.
- Resolve GitHub credentials from an explicit token, `BREWPUB_TOKEN`, `GITHUB_TOKEN`, or `gh auth token`, in that order.
- Provide `--dry-run` formula previews, `--json` results on stdout, human-readable status on stderr, verbose logging, and help/version commands.
- Export `publishFormula`, `getPackageRelease`, `renderFormula`, and `updateFormula` with types and defaults, plus local metadata, naming/version parsing, normalization, tap/token, result-formatting, and logger-injection helpers.

### Documentation

- Add installation guidance, CLI and TypeScript examples, GitHub Actions/token setup, and explanations of registry timing, livecheck, description audits, and Homebrew dependency cooldowns.

### Maintenance

- Establish TypeScript builds and package validation, mocked tests, shared linting and formatting, cross-platform CI, link checking, and release automation.

[Unreleased]: https://github.com/kitschpatrol/brewpub/compare/v0.5.1...HEAD
[0.1.0]: https://github.com/kitschpatrol/brewpub/releases/tag/v0.1.0
[0.2.0]: https://github.com/kitschpatrol/brewpub/compare/v0.1.0...v0.2.0
[0.3.0]: https://github.com/kitschpatrol/brewpub/compare/v0.2.0...v0.3.0
[0.3.1]: https://github.com/kitschpatrol/brewpub/compare/v0.3.0...v0.3.1
[0.4.0]: https://github.com/kitschpatrol/brewpub/compare/v0.3.1...v0.4.0
[0.5.0]: https://github.com/kitschpatrol/brewpub/compare/v0.4.0...v0.5.0
[0.5.1]: https://github.com/kitschpatrol/brewpub/compare/v0.5.0...v0.5.1
