import { beforeEach, describe, expect, it } from 'vitest'
import { createGitHubClient } from '../src/lib/github/client'
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
} from '../src/lib/github/tap'
import { fakeTap, getBlobSha, resetFakeTap } from './mocks/fixtures/github'

const INVALID_TAP = /Invalid tap/v
const NOT_FOUND = /homebrew-missing was not found/v
const NOT_A_FILE = /to be a file/v
const COMMIT_URL = /commit\/commit\d{4}$/v
const STALE_SHA = /sha does not match/v

const client = createGitHubClient('test-token')
const tap = { owner: 'example', repo: 'homebrew-tap' }

beforeEach(() => {
	resetFakeTap({
		'Casks/foo-bar.rb': 'cask',
		'Formula/custom/foo-bar.rb': 'nested formula',
		'Formula/other.rb': 'other formula',
		'README.md': 'readme',
	})
})

describe('parseTapName', () => {
	it.each([
		['example/tap', { owner: 'example', repo: 'homebrew-tap' }],
		['example/homebrew-tap', { owner: 'example', repo: 'homebrew-tap' }],
		['  example/tap  ', { owner: 'example', repo: 'homebrew-tap' }],
		['Some-Org/my.tap_1', { owner: 'Some-Org', repo: 'homebrew-my.tap_1' }],
	])('%j → %j', (input, expected) => {
		expect(parseTapName(input)).toEqual(expected)
	})

	it.each(['tap', 'a/b/c', '', 'https://github.com/example/homebrew-tap'])(
		'rejects %j',
		(input) => {
			expect(() => parseTapName(input)).toThrow(INVALID_TAP)
		},
	)
})

describe('getTapDefaultBranch', () => {
	it('returns the default branch', async () => {
		await expect(getTapDefaultBranch(client, tap)).resolves.toBe('main')
	})

	it('explains a missing repository', async () => {
		await expect(
			getTapDefaultBranch(client, { owner: 'example', repo: 'homebrew-missing' }),
		).rejects.toThrow(NOT_FOUND)
	})
})

describe('findFormulaFiles', () => {
	it('finds a formula nested under Formula and ignores casks', async () => {
		await expect(findFormulaFiles(client, tap, 'main', 'foo-bar')).resolves.toEqual([
			'Formula/custom/foo-bar.rb',
		])
	})

	it('returns nothing when the formula does not exist', async () => {
		await expect(findFormulaFiles(client, tap, 'main', 'nope')).resolves.toEqual([])
	})

	it('returns every match when there are duplicates', async () => {
		resetFakeTap({ 'Formula/foo-bar.rb': 'a', 'Formula/mirror/foo-bar.rb': 'b' })
		await expect(findFormulaFiles(client, tap, 'main', 'foo-bar')).resolves.toEqual([
			'Formula/foo-bar.rb',
			'Formula/mirror/foo-bar.rb',
		])
	})
})

describe('getTapFile', () => {
	it('returns decoded content and the blob sha', async () => {
		await expect(getTapFile(client, tap, 'Formula/custom/foo-bar.rb', 'main')).resolves.toEqual({
			content: 'nested formula',
			sha: getBlobSha('nested formula'),
		})
	})

	it('returns undefined for a missing file', async () => {
		await expect(getTapFile(client, tap, 'Formula/nope.rb', 'main')).resolves.toBeUndefined()
	})

	it('rejects directories', async () => {
		await expect(getTapFile(client, tap, 'Formula', 'main')).rejects.toThrow(NOT_A_FILE)
	})
})

describe('commitTapFile', () => {
	it('creates a new file', async () => {
		const commit = await commitTapFile(client, tap, {
			branch: 'main',
			content: 'new formula',
			message: 'new-thing 1.0.0 (new formula)',
			path: 'Formula/new-thing.rb',
		})

		expect(commit.url).toMatch(COMMIT_URL)
		expect(fakeTap.branches.get('main')?.get('Formula/new-thing.rb')).toBe('new formula')
		expect(fakeTap.commits).toEqual([
			expect.objectContaining({ branch: 'main', message: 'new-thing 1.0.0 (new formula)' }),
		])
	})

	it('updates an existing file when given its sha', async () => {
		await commitTapFile(client, tap, {
			branch: 'main',
			content: 'updated',
			message: 'foo-bar 1.2.3',
			path: 'Formula/custom/foo-bar.rb',
			sha: getBlobSha('nested formula'),
		})
		expect(fakeTap.branches.get('main')?.get('Formula/custom/foo-bar.rb')).toBe('updated')
	})

	it('fails to update an existing file with a stale sha', async () => {
		await expect(
			commitTapFile(client, tap, {
				branch: 'main',
				content: 'updated',
				message: 'foo-bar 1.2.3',
				path: 'Formula/custom/foo-bar.rb',
				sha: 'stale',
			}),
		).rejects.toThrow(STALE_SHA)
	})
})

describe('branches and pull requests', () => {
	it('checks and creates branches', async () => {
		await expect(hasBranch(client, tap, 'main')).resolves.toBe(true)
		await expect(hasBranch(client, tap, 'brewpub/foo-bar-1.2.3')).resolves.toBe(false)

		await createBranch(client, tap, { from: 'main', name: 'brewpub/foo-bar-1.2.3' })
		await expect(hasBranch(client, tap, 'brewpub/foo-bar-1.2.3')).resolves.toBe(true)
		expect(fakeTap.branches.get('brewpub/foo-bar-1.2.3')?.get('README.md')).toBe('readme')
	})

	it('finds and creates pull requests', async () => {
		await createBranch(client, tap, { from: 'main', name: 'feature' })
		await expect(findOpenPullRequest(client, tap, 'feature')).resolves.toBeUndefined()

		const created = await createPullRequest(client, tap, {
			base: 'main',
			body: 'body',
			head: 'feature',
			title: 'title',
		})
		expect(created).toEqual({ number: 1, url: 'https://github.com/example/homebrew-tap/pull/1' })
		await expect(findOpenPullRequest(client, tap, 'feature')).resolves.toEqual(created)
		expect(fakeTap.pullRequests[0]).toMatchObject({ base: 'main', body: 'body', title: 'title' })
	})
})
