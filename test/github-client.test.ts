import type childProcess from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveGitHubToken } from '../src/lib'

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', async (importOriginal) => ({
	...(await importOriginal<typeof childProcess>()),
	execFile: execFileMock,
}))

type ExecFileCallback = (error: Error | undefined, result: { stdout: string }) => void

function mockGhAuthToken(stdout: Error | string): void {
	execFileMock.mockImplementation((_file: string, _args: string[], callback: ExecFileCallback) => {
		if (stdout instanceof Error) {
			callback(stdout, { stdout: '' })
		} else {
			callback(undefined, { stdout })
		}
	})
}

describe('resolveGitHubToken', () => {
	afterEach(() => {
		vi.unstubAllEnvs()
		execFileMock.mockReset()
	})

	it('prefers an explicit token', async () => {
		vi.stubEnv('BREWPUB_TOKEN', 'env-brewpub')
		vi.stubEnv('GITHUB_TOKEN', 'env-github')
		await expect(resolveGitHubToken('explicit')).resolves.toBe('explicit')
		expect(execFileMock).not.toHaveBeenCalled()
	})

	it('falls back to BREWPUB_TOKEN, then GITHUB_TOKEN', async () => {
		vi.stubEnv('BREWPUB_TOKEN', 'env-brewpub')
		vi.stubEnv('GITHUB_TOKEN', 'env-github')
		await expect(resolveGitHubToken()).resolves.toBe('env-brewpub')

		vi.stubEnv('BREWPUB_TOKEN', '')
		await expect(resolveGitHubToken('  ')).resolves.toBe('env-github')
	})

	it('falls back to gh auth token', async () => {
		vi.stubEnv('BREWPUB_TOKEN', '')
		vi.stubEnv('GITHUB_TOKEN', '')
		mockGhAuthToken('gh-token\n')
		await expect(resolveGitHubToken()).resolves.toBe('gh-token')
		expect(execFileMock).toHaveBeenCalledWith('gh', ['auth', 'token'], expect.any(Function))
	})

	it('returns undefined when gh is unavailable', async () => {
		vi.stubEnv('BREWPUB_TOKEN', '')
		vi.stubEnv('GITHUB_TOKEN', '')
		mockGhAuthToken(new Error('gh: command not found'))
		await expect(resolveGitHubToken()).resolves.toBeUndefined()
	})

	it('returns undefined when gh prints nothing', async () => {
		vi.stubEnv('BREWPUB_TOKEN', '')
		vi.stubEnv('GITHUB_TOKEN', '')
		mockGhAuthToken('\n')
		await expect(resolveGitHubToken()).resolves.toBeUndefined()
	})
})
