import { defineTemplate, getMetadata, helpers } from 'metascope'
import path from 'node:path'
import { normalizeRepoUrl } from './utilities/repo-url'

/**
 * The parts of a local npm package that brewpub needs before consulting the
 * registry.
 */
export type LocalPackageInfo = {
	/** `homepage` from package.json, if any. */
	homepage: string | undefined
	name: string
	/**
	 * Repository URL from package.json or the git `origin` remote, normalized to
	 * `https`.
	 */
	repoUrl: string | undefined
	version: string
}

const template = defineTemplate((context) => ({
	gitOriginUrl: helpers.firstOf(context.gitConfig)?.data.remote?.origin?.url,
	packageJson: helpers.firstOf(context.nodePackageJson)?.data,
}))

/**
 * Read the name and version of the npm package in a directory, plus repository
 * hints used as a fallback for the formula's `homepage`. Runs metascope in
 * offline mode with only the local package.json and git config sources.
 *
 * @throws {Error} When the directory doesn't contain a package.json with a name
 *   and version.
 */
export async function getLocalPackageInfo(
	cwd: string,
	githubToken?: string,
): Promise<LocalPackageInfo> {
	const absolutePath = path.resolve(cwd)
	const { gitOriginUrl, packageJson } = await getMetadata({
		...(githubToken !== undefined && { credentials: { githubToken } }),
		offline: true,
		path: absolutePath,
		recursive: false,
		sources: ['gitConfig', 'nodePackageJson'],
		template,
		workspaces: false,
	})

	if (packageJson === undefined) {
		throw new Error(
			`No package.json found in ${absolutePath}. Run brewpub from the directory of a published npm package.`,
		)
	}

	const { homepage, name, repository, version } = packageJson
	if (typeof name !== 'string' || name === '' || typeof version !== 'string' || version === '') {
		throw new Error(`The package.json in ${absolutePath} needs both a "name" and a "version".`)
	}

	const repoCandidate = repository?.url ?? gitOriginUrl
	const repoUrl = typeof repoCandidate === 'string' ? normalizeRepoUrl(repoCandidate) : undefined

	return {
		homepage: typeof homepage === 'string' && homepage !== '' ? homepage : undefined,
		name,
		repoUrl,
		version,
	}
}
