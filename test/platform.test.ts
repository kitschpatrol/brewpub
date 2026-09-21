import { describe, expect, it } from 'vitest'
import { getPlatformRequirements } from '../src/lib'

describe('getPlatformRequirements', () => {
	it.each([
		[
			{ cpu: [], os: [] },
			{ arch: undefined, os: undefined },
		],
		[
			{ cpu: [], os: ['darwin'] },
			{ arch: undefined, os: 'macos' },
		],
		[
			{ cpu: [], os: ['linux'] },
			{ arch: undefined, os: 'linux' },
		],
		[
			{ cpu: [], os: ['darwin', 'linux'] },
			{ arch: undefined, os: undefined },
		],
		[
			{ cpu: [], os: ['!win32'] },
			{ arch: undefined, os: undefined },
		],
		[
			{ cpu: [], os: ['!linux'] },
			{ arch: undefined, os: 'macos' },
		],
		[
			{ cpu: [], os: ['darwin', 'win32'] },
			{ arch: undefined, os: 'macos' },
		],
		[
			{ cpu: ['arm64'], os: [] },
			{ arch: 'arm64', os: undefined },
		],
		[
			{ cpu: ['x64'], os: [] },
			{ arch: 'x86_64', os: undefined },
		],
		[
			{ cpu: ['x64', 'arm64'], os: [] },
			{ arch: undefined, os: undefined },
		],
		[
			{ cpu: ['!ia32'], os: [] },
			{ arch: undefined, os: undefined },
		],
		[
			{ cpu: ['!x64'], os: [] },
			{ arch: 'arm64', os: undefined },
		],
		[
			{ cpu: ['arm64'], os: ['darwin'] },
			{ arch: 'arm64', os: 'macos' },
		],
	])('%j → %j', (constraints, expected) => {
		expect(getPlatformRequirements(constraints)).toEqual({ ...expected, warnings: [] })
	})

	it('warns when nothing Homebrew supports is allowed', () => {
		const result = getPlatformRequirements({ cpu: ['ia32'], os: ['win32'] })
		expect(result.arch).toBeUndefined()
		expect(result.os).toBeUndefined()
		expect(result.warnings).toEqual([
			expect.stringContaining('"os" field (win32) excludes both macOS and Linux') as string,
			expect.stringContaining('"cpu" field (ia32) excludes both arm64 and x64') as string,
		])
	})
})
