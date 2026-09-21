/**
 * Homebrew `depends_on` constraints derived from a package's `os` and `cpu`
 * fields. Each is `undefined` when the package runs on every platform Homebrew
 * supports, or when the constraint can't be expressed in a formula.
 */
export type PlatformRequirements = {
	arch: 'arm64' | 'x86_64' | undefined
	os: 'linux' | 'macos' | undefined
	/** Problems that didn't prevent a result. */
	warnings: string[]
}

const HOMEBREW_OS = { darwin: 'macos', linux: 'linux' } as const
const HOMEBREW_ARCH = { arm64: 'arm64', x64: 'x86_64' } as const
const NPM_OS = Object.keys(HOMEBREW_OS) as Array<keyof typeof HOMEBREW_OS>
const NPM_CPU = Object.keys(HOMEBREW_ARCH) as Array<keyof typeof HOMEBREW_ARCH>

/**
 * Narrow the platforms Homebrew supports to those an npm constraint list
 * allows. npm lists are allowlists, except that entries prefixed with `!` are
 * exclusions.
 */
function getAllowed<T extends string>(constraints: string[], supported: readonly T[]): T[] {
	const excluded = new Set<string>()
	const included = new Set<string>()
	for (const constraint of constraints) {
		if (constraint.startsWith('!')) {
			excluded.add(constraint.slice(1))
		} else {
			included.add(constraint)
		}
	}

	return supported.filter(
		(platform) => (included.size === 0 || included.has(platform)) && !excluded.has(platform),
	)
}

/**
 * Map a package's `os` and `cpu` fields to Homebrew `depends_on` constraints.
 * `["darwin"]` becomes `depends_on :macos`, `["arm64"]` becomes `depends_on
 * arch: :arm64`, and lists that allow both of Homebrew's platforms produce no
 * constraint. A list that excludes every Homebrew platform yields a warning,
 * since the formula could never be installed.
 */
export function getPlatformRequirements(constraints: {
	cpu: string[]
	os: string[]
}): PlatformRequirements {
	const warnings: string[] = []

	const allowedOs = getAllowed(constraints.os, NPM_OS)
	const [onlyOs] = allowedOs
	const os = onlyOs !== undefined && allowedOs.length === 1 ? HOMEBREW_OS[onlyOs] : undefined
	if (allowedOs.length === 0) {
		warnings.push(
			`The package's "os" field (${constraints.os.join(', ')}) excludes both macOS and Linux, so Homebrew can't install it anywhere.`,
		)
	}

	const allowedCpu = getAllowed(constraints.cpu, NPM_CPU)
	const [onlyCpu] = allowedCpu
	const arch = onlyCpu !== undefined && allowedCpu.length === 1 ? HOMEBREW_ARCH[onlyCpu] : undefined
	if (allowedCpu.length === 0) {
		warnings.push(
			`The package's "cpu" field (${constraints.cpu.join(', ')}) excludes both arm64 and x64, so Homebrew can't install it anywhere.`,
		)
	}

	return { arch, os, warnings }
}
