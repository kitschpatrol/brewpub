import type { Options } from 'yargs'
import { DEFAULT_PUBLISH_FORMULA_OPTIONS } from '../lib'

export const cwdOption = {
	cwd: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.cwd,
		describe:
			'Directory of the npm package to publish as a formula. Defaults to the current directory.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const tapOption = {
	tap: {
		demandOption: true,
		describe:
			'GitHub repository of the Homebrew tap, as "owner/name" or "owner/homebrew-name". For example, "kitschpatrol/tap".',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const pathOption = {
	path: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.path,
		describe:
			'Directory inside the tap where new formulae are written, for example "Formula/custom". Existing formulae are updated wherever they already live under "Formula".',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const nameOption = {
	name: {
		describe: 'Formula name. Defaults to the package name without its scope.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const binOption = {
	bin: {
		describe:
			'The only executable the formula installs and tests, for packages with several "bin" entries. By default all entries are installed and the first is tested.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const descriptionOption = {
	description: {
		describe:
			'Formula description. Defaults to the package description, adjusted to satisfy `brew audit`.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const tokenOption = {
	token: {
		describe:
			'GitHub token with write access to the tap. Defaults to BREWPUB_TOKEN, then GITHUB_TOKEN, then `gh auth token`.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const prOption = {
	pr: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.pr,
		describe: 'Open a pull request instead of committing directly to the base branch.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const branchOption = {
	branch: {
		describe: "Base branch in the tap. Defaults to the repository's default branch.",
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const forceOption = {
	force: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.force,
		describe: 'Allow downgrading to an older version, and reuse an existing pull request branch.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const dryRunOption = {
	'dry-run': {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.dryRun,
		describe:
			'Resolve the package and print the formula without writing to the tap. Registry and tap reads still happen.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const jsonOption = {
	json: {
		default: false,
		describe: 'Print the result as JSON on stdout.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>

export const registryOption = {
	registry: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.registryUrl,
		describe: 'npm registry to resolve the package from.',
		type: 'string',
	},
} as const satisfies Record<string, Options>

export const timeoutOption = {
	timeout: {
		default: DEFAULT_PUBLISH_FORMULA_OPTIONS.timeoutMs / 1000,
		describe: 'Seconds to wait for the registry to serve the published version.',
		type: 'number',
	},
} as const satisfies Record<string, Options>

export const verboseOption = {
	verbose: {
		default: false,
		describe: 'Enable verbose logging.',
		type: 'boolean',
	},
} as const satisfies Record<string, Options>
