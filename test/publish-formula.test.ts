import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { formatPublishFormulaResult, publishFormula } from '../src/lib'
import {
	fooBarFormula,
	fooBarFormulaNewer,
	fooBarFormulaWithBottle,
	fooBarFormulaWithBottleCurrent,
} from './mocks/fixtures/formulas'
import { fakeTap, resetFakeTap } from './mocks/fixtures/github'
import { fooBar } from './mocks/fixtures/registry'

const COMMIT_URL = /commit\/commit\d{4}$/v
const NEWER_VERSION = /already has foo-bar 9\.0\.0, which is newer than 1\.2\.3/v
const DUPLICATES = /more than one formula named foo-bar/v
const BRANCH_EXISTS = /Branch brewpub\/foo-bar-1\.2\.3 already exists/v
const NO_PACKAGE_JSON = /No package.json found/v
const NO_BIN = /has no "bin" entry/v
const INVALID_NAME = /not a valid formula name/v
const NO_HOMEPAGE = /no homepage or repository URL/v
const INVALID_TAP = /Invalid tap/v
const DOWNGRADING = /Downgrading foo-bar from 9\.0\.0/v
const SHA1_ONLY = /SHA-1 only/v

const temporaryDirectories: string[] = []

async function createProject(packageJson: Record<string, unknown>): Promise<string> {
	const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'brewpub-test-'))
	await fs.writeFile(
		path.join(directory, 'package.json'),
		JSON.stringify(packageJson, undefined, 2),
	)
	temporaryDirectories.push(directory)
	return directory
}

const baseOptions = { cwd: '', tap: 'example/tap', token: 'test-token' }

beforeAll(async () => {
	baseOptions.cwd = await createProject({
		description: 'Local description is ignored in favor of the registry',
		homepage: 'https://local.example.com/foo-bar',
		name: 'foo-bar',
		repository: { type: 'git', url: 'git+https://github.com/example/foo-bar.git' },
		version: '1.2.3',
	})
})

beforeEach(() => {
	resetFakeTap({ 'Formula/other.rb': 'other', 'README.md': 'readme' })
})

afterAll(async () => {
	await Promise.all(
		temporaryDirectories.map(async (directory) =>
			fs.rm(directory, { force: true, recursive: true }),
		),
	)
})

describe('publishFormula', () => {
	it('creates a new formula and commits it to the default branch', async () => {
		const result = await publishFormula(baseOptions)

		expect(result).toMatchObject({
			action: 'created',
			commit: { url: expect.stringMatching(COMMIT_URL) as string },
			formula: {
				className: 'FooBar',
				content: fooBarFormula,
				name: 'foo-bar',
				path: 'Formula/foo-bar.rb',
			},
			isDryRun: false,
			package: {
				name: 'foo-bar',
				sha256: fooBar.sha256,
				tarballUrl: fooBar.tarballUrl,
				version: '1.2.3',
			},
			tap: { branch: 'main', owner: 'example', repo: 'homebrew-tap' },
			warnings: [],
		})
		expect(result.pullRequest).toBeUndefined()
		expect(fakeTap.branches.get('main')?.get('Formula/foo-bar.rb')).toBe(fooBarFormula)
		expect(fakeTap.commits).toEqual([
			expect.objectContaining({ branch: 'main', message: 'foo-bar 1.2.3 (new formula)' }),
		])
	})

	it('writes new formulae into the requested directory', async () => {
		const result = await publishFormula({ ...baseOptions, path: 'Formula/custom/' })
		expect(result.formula.path).toBe('Formula/custom/foo-bar.rb')
		expect(fakeTap.branches.get('main')?.has('Formula/custom/foo-bar.rb')).toBe(true)
	})

	it('honors formula name and description overrides', async () => {
		const result = await publishFormula({
			...baseOptions,
			description: 'the custom description.',
			name: 'foo-bar-cli',
		})
		expect(result.formula.path).toBe('Formula/foo-bar-cli.rb')
		expect(result.formula.className).toBe('FooBarCli')
		expect(result.formula.content).toContain('class FooBarCli < Formula')
		expect(result.formula.content).toContain('desc "Custom description"')
	})

	it('updates an existing formula in place wherever it lives', async () => {
		resetFakeTap({ 'Formula/custom/foo-bar.rb': fooBarFormulaWithBottle })

		const result = await publishFormula(baseOptions)

		expect(result.action).toBe('updated')
		expect(result.formula.path).toBe('Formula/custom/foo-bar.rb')
		expect(result.formula.content).toBe(fooBarFormulaWithBottleCurrent)
		expect(fakeTap.branches.get('main')?.get('Formula/custom/foo-bar.rb')).toBe(
			fooBarFormulaWithBottleCurrent,
		)
		expect(fakeTap.commits).toEqual([expect.objectContaining({ message: 'foo-bar 1.2.3' })])
	})

	it('does nothing when the formula is already current', async () => {
		resetFakeTap({ 'Formula/foo-bar.rb': fooBarFormulaWithBottleCurrent })

		const result = await publishFormula(baseOptions)

		expect(result.action).toBe('unchanged')
		expect(result.commit).toBeUndefined()
		expect(fakeTap.commits).toEqual([])
	})

	it('refuses to downgrade unless forced', async () => {
		resetFakeTap({ 'Formula/foo-bar.rb': fooBarFormulaNewer })

		await expect(publishFormula(baseOptions)).rejects.toThrow(NEWER_VERSION)
		expect(fakeTap.commits).toEqual([])

		const result = await publishFormula({ ...baseOptions, force: true })
		expect(result.action).toBe('updated')
		expect(result.warnings).toEqual([expect.stringMatching(DOWNGRADING) as string])
	})

	it('refuses when the tap has duplicate formulae', async () => {
		resetFakeTap({
			'Formula/foo-bar.rb': fooBarFormulaWithBottle,
			'Formula/mirror/foo-bar.rb': fooBarFormulaWithBottle,
		})
		await expect(publishFormula(baseOptions)).rejects.toThrow(DUPLICATES)
	})

	it('performs a dry run without writing', async () => {
		const result = await publishFormula({ ...baseOptions, dryRun: true })

		expect(result.action).toBe('created')
		expect(result.isDryRun).toBe(true)
		expect(result.formula.content).toBe(fooBarFormula)
		expect(result.commit).toBeUndefined()
		expect(fakeTap.commits).toEqual([])
		expect(fakeTap.branches.get('main')?.has('Formula/foo-bar.rb')).toBe(false)
	})

	it('opens a pull request on a dedicated branch', async () => {
		const result = await publishFormula({ ...baseOptions, pr: true })

		expect(result.tap.branch).toBe('brewpub/foo-bar-1.2.3')
		expect(result.pullRequest).toEqual({
			number: 1,
			url: 'https://github.com/example/homebrew-tap/pull/1',
		})
		expect(fakeTap.commits).toEqual([
			expect.objectContaining({
				branch: 'brewpub/foo-bar-1.2.3',
				message: 'foo-bar 1.2.3 (new formula)',
			}),
		])
		expect(fakeTap.branches.get('main')?.has('Formula/foo-bar.rb')).toBe(false)
		expect(fakeTap.branches.get('brewpub/foo-bar-1.2.3')?.get('Formula/foo-bar.rb')).toBe(
			fooBarFormula,
		)
		expect(fakeTap.pullRequests[0]).toMatchObject({
			base: 'main',
			body: expect.stringContaining('https://www.npmjs.com/package/foo-bar/v/1.2.3') as string,
			head: 'brewpub/foo-bar-1.2.3',
			title: 'foo-bar 1.2.3 (new formula)',
		})
	})

	it('uses an explicit base branch', async () => {
		fakeTap.branches.set('develop', new Map())
		const result = await publishFormula({ ...baseOptions, branch: 'develop' })
		expect(result.tap.branch).toBe('develop')
		expect(fakeTap.branches.get('develop')?.has('Formula/foo-bar.rb')).toBe(true)
		expect(fakeTap.branches.get('main')?.has('Formula/foo-bar.rb')).toBe(false)
	})

	it('refuses to reuse an existing pull request branch unless forced', async () => {
		await publishFormula({ ...baseOptions, pr: true })

		await expect(publishFormula({ ...baseOptions, pr: true })).rejects.toThrow(BRANCH_EXISTS)

		const result = await publishFormula({ ...baseOptions, force: true, pr: true })
		expect(result.pullRequest?.number).toBe(1)
		expect(fakeTap.pullRequests).toHaveLength(1)
		expect(fakeTap.commits).toHaveLength(2)
	})

	it('rejects a directory without a package.json', async () => {
		await expect(
			publishFormula({
				...baseOptions,
				cwd: path.join(import.meta.dirname, 'fixtures/projects/no-package'),
			}),
		).rejects.toThrow(NO_PACKAGE_JSON)
	})

	it('rejects packages without a bin entry', async () => {
		const cwd = await createProject({ name: 'no-bin', version: '1.0.0' })
		await expect(publishFormula({ ...baseOptions, cwd })).rejects.toThrow(NO_BIN)
	})

	it('rejects an invalid formula name override', async () => {
		await expect(publishFormula({ ...baseOptions, name: 'Foo Bar' })).rejects.toThrow(INVALID_NAME)
	})

	it('omits the license stanza and warns when the registry has no license', async () => {
		const cwd = await createProject({ name: 'no-license', version: '1.0.0' })
		const result = await publishFormula({ ...baseOptions, cwd })
		expect(result.formula.content).not.toContain('\n  license ')
		expect(result.warnings).toEqual([])
	})

	it('falls back to the repository url for the homepage', async () => {
		const cwd = await createProject({ name: 'no-homepage', version: '1.0.0' })
		const result = await publishFormula({ ...baseOptions, cwd })
		expect(result.formula.content).toContain('homepage "https://github.com/example/no-homepage"')
	})

	it('falls back to local package metadata for the homepage', async () => {
		const cwd = await createProject({
			homepage: 'https://local.example.com/bare',
			name: 'bare',
			version: '1.0.0',
		})
		const result = await publishFormula({ ...baseOptions, cwd })
		expect(result.formula.content).toContain('homepage "https://local.example.com/bare"')
	})

	it('propagates registry warnings', async () => {
		const cwd = await createProject({ name: 'shasum-only', version: '1.0.0' })
		const result = await publishFormula({ ...baseOptions, cwd })
		expect(result.warnings).toEqual([expect.stringMatching(SHA1_ONLY) as string])
	})

	it('errors when no homepage can be found', async () => {
		const cwd = await createProject({ name: 'bare', version: '1.0.0' })
		await expect(publishFormula({ ...baseOptions, cwd })).rejects.toThrow(NO_HOMEPAGE)
	})

	it('rejects an invalid tap before doing any work', async () => {
		await expect(publishFormula({ ...baseOptions, tap: 'nope' })).rejects.toThrow(INVALID_TAP)
	})
})

describe('formatPublishFormulaResult', () => {
	it('summarizes a commit', async () => {
		const result = await publishFormula(baseOptions)
		expect(formatPublishFormulaResult(result)).toBe(
			[
				'Created Formula/foo-bar.rb in example/homebrew-tap with foo-bar 1.2.3.',
				`Commit: ${result.commit?.url ?? ''}`,
			].join('\n'),
		)
	})

	it('summarizes a dry run with verbose details and warnings', async () => {
		const result = await publishFormula({
			...baseOptions,
			description: 'x'.repeat(90),
			dryRun: true,
		})
		expect(formatPublishFormulaResult(result, true)).toBe(
			[
				'Would create Formula/foo-bar.rb in example/homebrew-tap with foo-bar 1.2.3.',
				`Tarball: ${fooBar.tarballUrl}`,
				`SHA-256: ${fooBar.sha256}`,
				`Warning: ${result.warnings[0] ?? ''}`,
			].join('\n'),
		)
	})

	it('summarizes a pull request and an unchanged formula', async () => {
		const pullRequestResult = await publishFormula({ ...baseOptions, pr: true })
		expect(formatPublishFormulaResult(pullRequestResult)).toContain(
			'Pull request #1: https://github.com/example/homebrew-tap/pull/1',
		)

		resetFakeTap({ 'Formula/foo-bar.rb': fooBarFormulaWithBottleCurrent })
		const unchangedResult = await publishFormula(baseOptions)
		expect(formatPublishFormulaResult(unchangedResult)).toBe(
			'foo-bar 1.2.3 is already current in example/homebrew-tap (Formula/foo-bar.rb).',
		)
	})
})
