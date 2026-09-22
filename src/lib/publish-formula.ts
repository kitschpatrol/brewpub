import type { Octokit } from '@octokit/core'
import { defu } from 'defu'
import semver from 'semver'
import type { PlatformRequirements } from './formula/platform'
import type { TapFile, TapReference } from './github/tap'
import type { LocalPackageInfo } from './local-package'
import type { PackageRelease } from './registry'
import { normalizeDescription } from './formula/description'
import { getFormulaClassName, getFormulaName, isValidFormulaName } from './formula/name'
import { getPlatformRequirements } from './formula/platform'
import { renderFormula } from './formula/render'
import { updateFormula } from './formula/update'
import { createGitHubClient, resolveGitHubToken } from './github/client'
import {
	commitTapFile,
	createBranch,
	createPullRequest,
	findFormulaFiles,
	findOpenPullRequest,
	getTapDefaultBranch,
	getTapFile,
	hasBranch,
	parseTapName,
} from './github/tap'
import { getLocalPackageInfo } from './local-package'
import { log } from './log'
import { DEFAULT_REGISTRY_URL, getPackageRelease } from './registry'

/**
 * Options for {@link publishFormula}.
 */
export type PublishFormulaOptions = {
	/**
	 * The only executable the formula installs and tests. Must be one of the
	 * package's `bin` entries. By default every entry is installed and the first
	 * is tested.
	 */
	bin?: string | undefined
	/** Base branch in the tap. Defaults to the repository's default branch. */
	branch?: string | undefined
	/**
	 * Local directory of the npm package. Defaults to the current working
	 * directory.
	 */
	cwd?: string | undefined
	/**
	 * Formula description override. Defaults to the package description,
	 * normalized.
	 */
	description?: string | undefined
	/** Resolve the package and render the formula, but don't write to the tap. */
	dryRun?: boolean | undefined
	/**
	 * Overwrite an older or equal version and reuse an existing pull request
	 * branch.
	 */
	force?: boolean | undefined
	/** Formula name override. Defaults to the unscoped package name. */
	name?: string | undefined
	/**
	 * Directory inside the tap for new formulae, e.g. `Formula/custom`. Defaults
	 * to `Formula`.
	 */
	path?: string | undefined
	/** Open a pull request instead of committing to the base branch. */
	pr?: boolean | undefined
	/** The npm registry to resolve the package from. */
	registryUrl?: string | undefined
	/** GitHub repository of the tap, as `owner/name` or `owner/homebrew-name`. */
	tap: string
	/**
	 * How long to wait for the registry to serve the published version, in
	 * milliseconds.
	 */
	timeoutMs?: number | undefined
	/**
	 * GitHub token. Defaults to `BREWPUB_TOKEN`, `GITHUB_TOKEN`, then `gh auth
	 * token`.
	 */
	token?: string | undefined
}

/**
 * The subset of {@link PublishFormulaOptions} that always has a value.
 */
export type PublishFormulaDefaults = {
	cwd: string
	dryRun: boolean
	force: boolean
	path: string
	pr: boolean
	registryUrl: string
	timeoutMs: number
}

/** Defaults for {@link publishFormula}. */
export const DEFAULT_PUBLISH_FORMULA_OPTIONS: PublishFormulaDefaults = {
	cwd: '.',
	dryRun: false,
	force: false,
	path: 'Formula',
	pr: false,
	registryUrl: DEFAULT_REGISTRY_URL,
	timeoutMs: 600_000,
}

/**
 * What {@link publishFormula} did, or would have done in a dry run.
 */
export type PublishFormulaResult = {
	action: 'created' | 'unchanged' | 'updated'
	/** Present when a commit was made. */
	commit?: { sha: string; url: string }
	formula: {
		className: string
		/** Full formula source as written to the tap. */
		content: string
		name: string
		/** Path of the formula within the tap repository. */
		path: string
	}
	isDryRun: boolean
	package: {
		name: string
		sha256: string
		tarballUrl: string
		version: string
	}
	/** Present when a pull request was opened or reused. */
	pullRequest?: { number: number; url: string }
	tap: {
		/** Branch the formula was written to, or would be. */
		branch: string
		owner: string
		repo: string
	}
	warnings: string[]
}

type ResolvedOptions = Omit<PublishFormulaOptions, keyof PublishFormulaDefaults> &
	PublishFormulaDefaults

type FormulaInputs = {
	arch: PlatformRequirements['arch']
	binName: string
	binOnly: boolean
	description: string
	formulaName: string
	homepage: string
	license: string | undefined
	os: PlatformRequirements['os']
	warnings: string[]
}

type FormulaPlan = {
	action: PublishFormulaResult['action']
	content: string
	existing: TapFile | undefined
	path: string
	warnings: string[]
}

const SIMPLE_SPDX_ID = /^[A-Za-z0-9.+\-]+$/v
const TRAILING_SLASHES = /\/+$/v

function getFormulaInputs(
	local: LocalPackageInfo,
	release: PackageRelease,
	options: ResolvedOptions,
): FormulaInputs {
	const warnings: string[] = []

	const formulaName = options.name ?? getFormulaName(local.name)
	if (!isValidFormulaName(formulaName)) {
		throw new Error(
			`"${formulaName}" is not a valid formula name. Use lowercase letters, digits, ".", "_", "+", "@", and "-".`,
		)
	}

	const binName = options.bin ?? release.binNames[0]
	if (binName === undefined) {
		throw new Error(
			`${local.name}@${local.version} has no "bin" entry. Homebrew formulae created by brewpub need a command to install and test.`,
		)
	}

	if (!release.binNames.includes(binName)) {
		throw new Error(
			`${local.name}@${local.version} has no "bin" entry named "${binName}". Available: ${release.binNames.join(', ')}.`,
		)
	}

	const normalized = normalizeDescription(options.description ?? release.description ?? '', {
		formulaName,
	})
	warnings.push(...normalized.warnings)

	const homepage = release.homepage ?? release.repoUrl ?? local.homepage ?? local.repoUrl
	if (homepage === undefined) {
		throw new Error(
			`${local.name} has no homepage or repository URL. Add a "homepage" field to package.json.`,
		)
	}

	let license: string | undefined
	if (release.license !== undefined) {
		if (SIMPLE_SPDX_ID.test(release.license)) {
			license = release.license
		} else {
			warnings.push(
				`License "${release.license}" is not a single SPDX identifier, so the formula has no license stanza. Add one by hand if needed.`,
			)
		}
	}

	const platform = getPlatformRequirements({ cpu: local.cpu, os: local.os })
	warnings.push(...platform.warnings)

	return {
		arch: platform.arch,
		binName,
		binOnly: options.bin !== undefined,
		description: normalized.description,
		formulaName,
		homepage,
		license,
		os: platform.os,
		warnings,
	}
}

function isNewerThan(previousVersion: string | undefined, version: string): boolean {
	return (
		previousVersion !== undefined &&
		semver.valid(previousVersion) !== null &&
		semver.valid(version) !== null &&
		semver.gt(previousVersion, version)
	)
}

async function planFormula(
	client: Octokit,
	tap: TapReference,
	baseBranch: string,
	inputs: FormulaInputs,
	release: PackageRelease,
	options: ResolvedOptions,
): Promise<FormulaPlan> {
	const existingPaths = await findFormulaFiles(client, tap, baseBranch, inputs.formulaName)
	if (existingPaths.length > 1) {
		throw new Error(
			`Found more than one formula named ${inputs.formulaName} in ${tap.owner}/${tap.repo}: ${existingPaths.join(', ')}. Remove the duplicates first.`,
		)
	}

	const existingPath = existingPaths[0]
	if (existingPath === undefined) {
		const content = renderFormula({
			arch: inputs.arch,
			binName: inputs.binName,
			binOnly: inputs.binOnly,
			description: inputs.description,
			formulaName: inputs.formulaName,
			homepage: inputs.homepage,
			license: inputs.license,
			os: inputs.os,
			sha256: release.sha256,
			url: release.tarballUrl,
		})
		const path = `${options.path.replace(TRAILING_SLASHES, '')}/${inputs.formulaName}.rb`
		return { action: 'created', content, existing: undefined, path, warnings: [] }
	}

	const existing = await getTapFile(client, tap, existingPath, baseBranch)
	if (existing === undefined) {
		throw new Error(`${existingPath} disappeared from ${tap.owner}/${tap.repo} while reading it.`)
	}

	const update = updateFormula(existing.content, {
		sha256: release.sha256,
		url: release.tarballUrl,
	})

	const warnings: string[] = []
	if (isNewerThan(update.previousVersion, release.version)) {
		if (!options.force) {
			throw new Error(
				`${tap.owner}/${tap.repo} already has ${inputs.formulaName} ${update.previousVersion ?? ''}, which is newer than ${release.version}. Pass "force" to downgrade.`,
			)
		}

		warnings.push(
			`Downgrading ${inputs.formulaName} from ${update.previousVersion ?? ''} to ${release.version}.`,
		)
	}

	return {
		action: update.isChanged ? 'updated' : 'unchanged',
		content: update.content,
		existing,
		path: existingPath,
		warnings,
	}
}

async function openPullRequest(
	client: Octokit,
	tap: TapReference,
	plan: FormulaPlan,
	release: PackageRelease,
	message: string,
	baseBranch: string,
	isForce: boolean,
): Promise<Pick<PublishFormulaResult, 'commit' | 'pullRequest'> & { branch: string }> {
	const headBranch = `brewpub/${release.name}-${release.version}`.replaceAll('@', '')
	const isExistingBranch = await hasBranch(client, tap, headBranch)
	let existingPullRequest: PublishFormulaResult['pullRequest']

	if (isExistingBranch) {
		if (!isForce) {
			throw new Error(
				`Branch ${headBranch} already exists in ${tap.owner}/${tap.repo}. Delete it, or pass "force" to update it.`,
			)
		}

		existingPullRequest = await findOpenPullRequest(client, tap, headBranch)
	} else {
		await createBranch(client, tap, { from: baseBranch, name: headBranch })
	}

	const headFile = isExistingBranch
		? await getTapFile(client, tap, plan.path, headBranch)
		: plan.existing

	const commit = await commitTapFile(client, tap, {
		branch: headBranch,
		content: plan.content,
		message,
		path: plan.path,
		sha: headFile?.sha,
	})

	const pullRequest =
		existingPullRequest ??
		(await createPullRequest(client, tap, {
			base: baseBranch,
			body: [
				`Mirrors [${release.name}@${release.version}](https://www.npmjs.com/package/${release.name}/v/${release.version}) from npm.`,
				'',
				`Generated by [brewpub](https://github.com/kitschpatrol/brewpub).`,
			].join('\n'),
			head: headBranch,
			title: message,
		}))

	return { branch: headBranch, commit, pullRequest }
}

/**
 * Publish the npm package in `cwd` as a Homebrew formula in a GitHub-hosted
 * tap. Creates the formula if it doesn't exist, otherwise updates only its
 * `url` and `sha256`. Commits directly to the base branch unless `pr` is set.
 */
export async function publishFormula(
	options: PublishFormulaOptions,
): Promise<PublishFormulaResult> {
	const resolved: ResolvedOptions = defu(options, DEFAULT_PUBLISH_FORMULA_OPTIONS)
	const tap = parseTapName(resolved.tap)

	const token = await resolveGitHubToken(resolved.token)
	if (token === undefined && !resolved.dryRun) {
		throw new Error(
			'No GitHub token found. Pass one with the "token" option, set GITHUB_TOKEN, or run `gh auth login`.',
		)
	}

	const local = await getLocalPackageInfo(resolved.cwd, token)
	log.info(`Resolving ${local.name}@${local.version} from ${resolved.registryUrl}`)
	const release = await getPackageRelease(local.name, local.version, {
		registryUrl: resolved.registryUrl,
		timeoutMs: resolved.timeoutMs,
	})

	const inputs = getFormulaInputs(local, release, resolved)
	const client = createGitHubClient(token)
	const baseBranch = resolved.branch ?? (await getTapDefaultBranch(client, tap))
	const plan = await planFormula(client, tap, baseBranch, inputs, release, resolved)

	const result: PublishFormulaResult = {
		action: plan.action,
		formula: {
			className: getFormulaClassName(inputs.formulaName),
			content: plan.content,
			name: inputs.formulaName,
			path: plan.path,
		},
		isDryRun: resolved.dryRun,
		package: {
			name: local.name,
			sha256: release.sha256,
			tarballUrl: release.tarballUrl,
			version: release.version,
		},
		tap: { branch: baseBranch, owner: tap.owner, repo: tap.repo },
		warnings: [...release.warnings, ...inputs.warnings, ...plan.warnings],
	}

	for (const warning of result.warnings) {
		log.warn(warning)
	}

	if (plan.action === 'unchanged' || resolved.dryRun) {
		return result
	}

	const message =
		plan.action === 'created'
			? `${inputs.formulaName} ${release.version} (new formula)`
			: `${inputs.formulaName} ${release.version}`

	if (resolved.pr) {
		const { branch, commit, pullRequest } = await openPullRequest(
			client,
			tap,
			plan,
			release,
			message,
			baseBranch,
			resolved.force,
		)
		result.tap.branch = branch
		result.commit = commit
		result.pullRequest = pullRequest
		return result
	}

	result.commit = await commitTapFile(client, tap, {
		branch: baseBranch,
		content: plan.content,
		message,
		path: plan.path,
		sha: plan.existing?.sha,
	})

	return result
}

/**
 * Summarize a {@link PublishFormulaResult} for humans, one line per fact.
 */
export function formatPublishFormulaResult(
	result: PublishFormulaResult,
	isVerbose = false,
): string {
	const tapName = `${result.tap.owner}/${result.tap.repo}`
	const release = `${result.formula.name} ${result.package.version}`
	const lines: string[] = []

	if (result.action === 'unchanged') {
		lines.push(`${release} is already current in ${tapName} (${result.formula.path}).`)
	} else if (result.isDryRun) {
		const verb = result.action === 'created' ? 'create' : 'update'
		lines.push(`Would ${verb} ${result.formula.path} in ${tapName} with ${release}.`)
	} else {
		const verb = result.action === 'created' ? 'Created' : 'Updated'
		lines.push(`${verb} ${result.formula.path} in ${tapName} with ${release}.`)
	}

	if (result.commit !== undefined) {
		lines.push(`Commit: ${result.commit.url}`)
	}

	if (result.pullRequest !== undefined) {
		lines.push(`Pull request #${result.pullRequest.number}: ${result.pullRequest.url}`)
	}

	if (isVerbose) {
		lines.push(`Tarball: ${result.package.tarballUrl}`, `SHA-256: ${result.package.sha256}`)
	}

	for (const warning of result.warnings) {
		lines.push(`Warning: ${warning}`)
	}

	return lines.join('\n')
}
