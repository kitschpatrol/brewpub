/* eslint-disable ts/naming-convention -- Environment variable names. */

import { execFile } from 'node:child_process'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const cliPath = path.resolve(import.meta.dirname, '../dist/bin/cli.js')
const noPackageDirectory = path.resolve(import.meta.dirname, 'fixtures/projects/no-package')
const SEMVER = /\d+\.\d+\.\d+/v
const WHITESPACE = /\s+/gv

type RunResult = { code: number; stderr: string; stdout: string }

/** Environment without any brewpub or GitHub settings from the host. */
const cleanEnv = Object.fromEntries(
	Object.entries(process.env).filter(
		([key]) => key !== 'GITHUB_TOKEN' && !key.startsWith('BREWPUB_'),
	),
)

async function run(
	args: string[],
	options: { cwd?: string; env?: Record<string, string> } = {},
): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		execFile(
			'node',
			[cliPath, ...args],
			{ cwd: options.cwd ?? noPackageDirectory, env: { ...cleanEnv, ...options.env } },
			(error, stdout, stderr) => {
				if (error && typeof error.code !== 'number') {
					reject(error instanceof Error ? error : new Error('Failed to run the CLI'))
					return
				}

				resolve({ code: typeof error?.code === 'number' ? error.code : 0, stderr, stdout })
			},
		)
	})
}

describe('cli', () => {
	it('prints the version', async () => {
		const { code, stdout } = await run(['--version'])
		expect(code).toBe(0)
		expect(stdout).toMatch(SEMVER)
	})

	it('prints help listing every option', async () => {
		const { code, stdout } = await run(['--help'])
		expect(code).toBe(0)
		for (const option of [
			'--tap',
			'--cwd',
			'--path',
			'--name',
			'--description',
			'--token',
			'--pr',
			'--branch',
			'--force',
			'--dry-run',
			'--json',
			'--registry',
			'--timeout',
			'--verbose',
		]) {
			expect(stdout).toContain(option)
		}
	})

	it('requires a tap', async () => {
		const { code, stderr } = await run([])
		expect(code).toBe(1)
		expect(stderr).toContain('Missing required argument: tap')
	})

	it('rejects unknown options', async () => {
		const { code, stderr } = await run(['--tap', 'example/tap', '--bogus'])
		expect(code).toBe(1)
		expect(stderr).toContain('Unknown argument: bogus')
	})

	it('fails clearly outside an npm package', async () => {
		const { code, stderr } = await run(['--tap', 'example/tap', '--dry-run'], {
			env: { GITHUB_TOKEN: 'x' },
		})
		expect(code).toBe(1)
		expect(stderr).toContain('No package.json found')
	})

	it('reads the tap from the environment', async () => {
		const { code, stderr } = await run(['--dry-run'], {
			env: { BREWPUB_TAP: 'example/tap', GITHUB_TOKEN: 'x' },
		})
		expect(code).toBe(1)
		expect(stderr).not.toContain('Missing required argument')
		expect(stderr).toContain('No package.json found')
	})

	it('accepts the package directory as --cwd or BREWPUB_CWD', async () => {
		const flagRun = await run(['--tap', 'example/tap', '--dry-run', '--cwd', noPackageDirectory], {
			cwd: import.meta.dirname,
			env: { GITHUB_TOKEN: 'x' },
		})
		expect(flagRun.code).toBe(1)
		expect(flagRun.stderr.replaceAll(WHITESPACE, ' ')).toContain(
			`No package.json found in ${noPackageDirectory}`,
		)

		const envRun = await run(['--tap', 'example/tap', '--dry-run'], {
			cwd: import.meta.dirname,
			env: { BREWPUB_CWD: noPackageDirectory, GITHUB_TOKEN: 'x' },
		})
		expect(envRun.code).toBe(1)
		expect(envRun.stderr.replaceAll(WHITESPACE, ' ')).toContain(
			`No package.json found in ${noPackageDirectory}`,
		)
	})
})
