import { createHash } from 'node:crypto'

/**
 * A commit recorded by the fake GitHub contents API.
 */
type FakeCommit = {
	branch: string
	message: string
	path: string
	sha: string
}

type FakePullRequest = {
	base: string
	body: string
	head: string
	htmlUrl: string
	number: number
	state: 'closed' | 'open'
	title: string
}

/**
 * In-memory state for a fake GitHub-hosted tap: branches map file paths to
 * contents, and every write is recorded so tests can assert on it.
 */
export type FakeTap = {
	branches: Map<string, Map<string, string>>
	commits: FakeCommit[]
	defaultBranch: string
	owner: string
	pullRequests: FakePullRequest[]
	repo: string
}

export const fakeTap: FakeTap = {
	branches: new Map(),
	commits: [],
	defaultBranch: 'main',
	owner: 'example',
	pullRequests: [],
	repo: 'homebrew-tap',
}

/**
 * Reset the fake tap to a single `main` branch containing `files`.
 */
export function resetFakeTap(files: Record<string, string> = {}): void {
	fakeTap.branches = new Map([['main', new Map(Object.entries(files))]])
	fakeTap.commits = []
	fakeTap.pullRequests = []
	fakeTap.defaultBranch = 'main'
}

/** Git-style blob SHA for file content. */
export function getBlobSha(content: string): string {
	return createHash('sha1').update(`blob ${content.length}\0${content}`).digest('hex')
}

/** Deterministic fake head SHA for a branch name. */
export function getBranchSha(branch: string): string {
	return createHash('sha1').update(`branch:${branch}`).digest('hex')
}

/** Resolve a fake head SHA back to its branch name. */
export function getBranchBySha(sha: string): string | undefined {
	for (const branch of fakeTap.branches.keys()) {
		if (getBranchSha(branch) === sha) {
			return branch
		}
	}

	return undefined
}
