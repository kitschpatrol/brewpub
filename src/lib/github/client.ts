import { Octokit } from '@octokit/core'
import { retry } from '@octokit/plugin-retry'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { name, version } from '../../../package.json' with { type: 'json' }
import { log } from '../log'

// eslint-disable-next-line ts/strict-void-return -- Node typings for execFile return the child process.
const execFileAsync = promisify(execFile)

// eslint-disable-next-line ts/naming-convention -- The plugin API returns a constructor.
const GitHubOctokit = Octokit.plugin(retry)

/**
 * Create a GitHub REST client that retries transient failures and routes its
 * logging through brewpub's logger.
 */
export function createGitHubClient(token: string | undefined): Octokit {
	return new GitHubOctokit({
		...(token !== undefined && { auth: token }),
		log: {
			debug(message: string) {
				log.debug(message)
			},
			error(message: string) {
				log.error(message)
			},
			info(message: string) {
				log.debug(message)
			},
			warn(message: string) {
				log.warn(message)
			},
		},
		// A 409 from the contents API means the blob sha is stale; retrying can't fix it.
		retry: { doNotRetry: [400, 401, 403, 404, 409, 422, 451] },
		userAgent: `${name}/${version}`,
	})
}

/**
 * Find a GitHub token. Checks, in order: the explicit argument, the
 * `BREWPUB_TOKEN` and `GITHUB_TOKEN` environment variables, and the GitHub CLI
 * (`gh auth token`). Returns `undefined` when none is available.
 */
export async function resolveGitHubToken(explicitToken?: string): Promise<string | undefined> {
	const candidates = [explicitToken, process.env.BREWPUB_TOKEN, process.env.GITHUB_TOKEN]
	for (const candidate of candidates) {
		if (candidate !== undefined && candidate.trim() !== '') {
			return candidate.trim()
		}
	}

	try {
		const { stdout } = await execFileAsync('gh', ['auth', 'token'])
		const token = stdout.trim()
		if (token !== '') {
			log.debug('Using GitHub token from `gh auth token`')
			return token
		}
	} catch {
		log.debug('GitHub CLI is unavailable or not authenticated')
	}

	return undefined
}

/**
 * Extract the HTTP status from an error thrown by octokit, if any.
 */
export function getResponseStatus(error: unknown): number | undefined {
	return typeof error === 'object' &&
		error !== null &&
		'status' in error &&
		typeof error.status === 'number'
		? error.status
		: undefined
}
