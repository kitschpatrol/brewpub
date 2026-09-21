import type { Octokit } from '@octokit/core'
import path from 'node:path/posix'
import { log } from '../log'
import { decodeBase64, encodeBase64 } from '../utilities/base64'
import { getResponseStatus } from './client'

/**
 * A GitHub-hosted Homebrew tap repository.
 */
export type TapReference = {
	owner: string
	/** Repository name, always with the `homebrew-` prefix. */
	repo: string
}

/**
 * A formula file as stored in the tap.
 */
export type TapFile = {
	content: string
	/** Git blob SHA, required by the contents API when updating. */
	sha: string
}

const TAP_NAME = /^(?<owner>[\w.\-]+)\/(?<repo>[\w.\-]+)$/v
const FORMULA_DIRECTORY = 'Formula/'

/**
 * Parse a tap name as accepted by `brew tap`: `owner/name` or
 * `owner/homebrew-name`, both referring to the `homebrew-name` repository.
 *
 * @throws {Error} When the value isn't of the form `owner/name`.
 */
export function parseTapName(tap: string): TapReference {
	const match = TAP_NAME.exec(tap.trim())
	if (match?.groups?.owner === undefined || match.groups.repo === undefined) {
		throw new Error(
			`Invalid tap "${tap}". Expected "owner/name" or "owner/homebrew-name", e.g. "kitschpatrol/tap".`,
		)
	}

	const { owner, repo } = match.groups
	return { owner, repo: repo.startsWith('homebrew-') ? repo : `homebrew-${repo}` }
}

/**
 * Look up the tap's default branch.
 *
 * @throws {Error} When the repository doesn't exist or the token can't see it.
 */
export async function getTapDefaultBranch(client: Octokit, tap: TapReference): Promise<string> {
	try {
		const { data } = await client.request('GET /repos/{owner}/{repo}', {
			owner: tap.owner,
			repo: tap.repo,
		})
		return data.default_branch
	} catch (error) {
		if (getResponseStatus(error) === 404) {
			throw new Error(
				`Tap ${tap.owner}/${tap.repo} was not found on GitHub, or the token can't access it.`,
				{ cause: error },
			)
		}

		throw error
	}
}

/**
 * Find existing formula files named `<formulaName>.rb` anywhere under the tap's
 * `Formula/` directory, so a formula that was moved into a subdirectory is
 * updated in place rather than duplicated.
 */
export async function findFormulaFiles(
	client: Octokit,
	tap: TapReference,
	branch: string,
	formulaName: string,
): Promise<string[]> {
	const { data } = await client.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
		owner: tap.owner,
		recursive: '1',
		repo: tap.repo,
		// eslint-disable-next-line ts/naming-convention -- GitHub API parameter name.
		tree_sha: branch,
	})

	if (data.truncated) {
		log.warn(
			`The tree for ${tap.owner}/${tap.repo} is too large to list completely; only the default formula path will be checked.`,
		)
	}

	const fileName = `${formulaName}.rb`
	const matches: string[] = []
	for (const entry of data.tree) {
		if (
			entry.type === 'blob' &&
			entry.path.startsWith(FORMULA_DIRECTORY) &&
			path.basename(entry.path) === fileName
		) {
			matches.push(entry.path)
		}
	}

	return matches
}

/**
 * Read a file from the tap. Returns `undefined` when it doesn't exist.
 *
 * @throws {Error} When the path is a directory or something other than a file.
 */
export async function getTapFile(
	client: Octokit,
	tap: TapReference,
	filePath: string,
	ref: string,
): Promise<TapFile | undefined> {
	let data
	try {
		;({ data } = await client.request('GET /repos/{owner}/{repo}/contents/{path}', {
			owner: tap.owner,
			path: filePath,
			ref,
			repo: tap.repo,
		}))
	} catch (error) {
		if (getResponseStatus(error) === 404) {
			return undefined
		}

		throw error
	}

	if (Array.isArray(data) || data.type !== 'file') {
		throw new Error(`Expected ${filePath} in ${tap.owner}/${tap.repo} to be a file.`)
	}

	return { content: decodeBase64(data.content), sha: data.sha }
}

/**
 * Create or update a single file on a branch, producing one commit.
 */
export async function commitTapFile(
	client: Octokit,
	tap: TapReference,
	options: {
		branch: string
		content: string
		message: string
		path: string
		/** Blob SHA of the existing file. Omit when creating. */
		sha?: string | undefined
	},
): Promise<{ sha: string; url: string }> {
	const { data } = await client.request('PUT /repos/{owner}/{repo}/contents/{path}', {
		branch: options.branch,
		content: encodeBase64(options.content),
		message: options.message,
		owner: tap.owner,
		path: options.path,
		repo: tap.repo,
		...(options.sha !== undefined && { sha: options.sha }),
	})

	const { sha } = data.commit
	const url = data.commit.html_url
	if (sha === undefined || url === undefined) {
		throw new Error(`GitHub did not return commit details for ${options.path}.`)
	}

	return { sha, url }
}

/**
 * Whether a branch exists in the tap.
 */
export async function hasBranch(
	client: Octokit,
	tap: TapReference,
	branch: string,
): Promise<boolean> {
	try {
		await client.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
			owner: tap.owner,
			ref: `heads/${branch}`,
			repo: tap.repo,
		})
		return true
	} catch (error) {
		if (getResponseStatus(error) === 404) {
			return false
		}

		throw error
	}
}

/**
 * Create a branch pointing at the tip of another branch.
 */
export async function createBranch(
	client: Octokit,
	tap: TapReference,
	options: { from: string; name: string },
): Promise<void> {
	const { data } = await client.request('GET /repos/{owner}/{repo}/git/ref/{ref}', {
		owner: tap.owner,
		ref: `heads/${options.from}`,
		repo: tap.repo,
	})

	await client.request('POST /repos/{owner}/{repo}/git/refs', {
		owner: tap.owner,
		ref: `refs/heads/${options.name}`,
		repo: tap.repo,
		sha: data.object.sha,
	})
}

/**
 * Find an open pull request whose head is the given branch.
 */
export async function findOpenPullRequest(
	client: Octokit,
	tap: TapReference,
	headBranch: string,
): Promise<undefined | { number: number; url: string }> {
	const { data } = await client.request('GET /repos/{owner}/{repo}/pulls', {
		head: `${tap.owner}:${headBranch}`,
		owner: tap.owner,
		repo: tap.repo,
		state: 'open',
	})

	const pullRequest = data[0]
	return pullRequest === undefined
		? undefined
		: { number: pullRequest.number, url: pullRequest.html_url }
}

/**
 * Open a pull request.
 */
export async function createPullRequest(
	client: Octokit,
	tap: TapReference,
	options: { base: string; body: string; head: string; title: string },
): Promise<{ number: number; url: string }> {
	const { data } = await client.request('POST /repos/{owner}/{repo}/pulls', {
		base: options.base,
		body: options.body,
		head: options.head,
		owner: tap.owner,
		repo: tap.repo,
		title: options.title,
	})

	return { number: data.number, url: data.html_url }
}
