import { createHash } from 'node:crypto'

/**
 * A fake published package: the registry manifest for one version plus the
 * tarball bytes it points at, with integrity values that agree with the bytes.
 */
export type RegistryFixture = {
	manifest: Record<string, unknown>
	sha256: string
	tarballBytes: Uint8Array
	tarballUrl: string
}

type FixtureOptions = {
	bin?: Record<string, string> | string | undefined
	description?: string | undefined
	homepage?: string | undefined
	integrity?: string | undefined
	license?: Record<string, unknown> | string | undefined
	name: string
	repository?: Record<string, unknown> | string | undefined
	shasum?: string | undefined
	version: string
}

function getTarballUrl(name: string, version: string): string {
	const unscoped = name.startsWith('@') ? name.slice(name.indexOf('/') + 1) : name
	return `https://registry.npmjs.org/${name}/-/${unscoped}-${version}.tgz`
}

/**
 * Build a registry fixture. Integrity values default to correct ones computed
 * from the tarball bytes; pass `integrity` or `shasum` explicitly to override.
 */
function createRegistryFixture(options: FixtureOptions): RegistryFixture {
	const tarballBytes = new TextEncoder().encode(
		`fake tarball for ${options.name}@${options.version}`,
	)
	const tarballUrl = getTarballUrl(options.name, options.version)
	const sha512 = createHash('sha512').update(tarballBytes).digest('base64')
	const sha1 = createHash('sha1').update(tarballBytes).digest('hex')
	const sha256 = createHash('sha256').update(tarballBytes).digest('hex')

	const distribution: Record<string, unknown> = { tarball: tarballUrl }
	if ('integrity' in options) {
		if (options.integrity !== undefined) {
			distribution.integrity = options.integrity
		}
	} else {
		distribution.integrity = `sha512-${sha512}`
	}

	if ('shasum' in options) {
		if (options.shasum !== undefined) {
			distribution.shasum = options.shasum
		}
	} else {
		distribution.shasum = sha1
	}

	const manifest: Record<string, unknown> = {
		dist: distribution,
		name: options.name,
		version: options.version,
	}

	for (const key of ['bin', 'description', 'homepage', 'license', 'repository'] as const) {
		if (options[key] !== undefined) {
			manifest[key] = options[key]
		}
	}

	return { manifest, sha256, tarballBytes, tarballUrl }
}

export const fooBar = createRegistryFixture({
	bin: { 'foo-bar': 'dist/cli.js', 'foo-bar-extra': 'dist/extra.js' },
	description: 'A command line tool for doing things.',
	homepage: 'https://github.com/example/foo-bar',
	license: 'MIT',
	name: 'foo-bar',
	repository: { type: 'git', url: 'git+https://github.com/example/foo-bar.git' },
	version: '1.2.3',
})

export const scopedFooBar = createRegistryFixture({
	bin: 'dist/cli.js',
	description: 'Scoped things',
	license: { type: 'ISC' },
	name: '@scope/foo-bar',
	repository: 'github:scope/foo-bar',
	version: '2.0.0',
})

const noBin = createRegistryFixture({
	description: 'Library only',
	homepage: 'https://example.com',
	license: 'MIT',
	name: 'no-bin',
	version: '1.0.0',
})

const noLicense = createRegistryFixture({
	bin: { 'no-license': 'cli.js' },
	description: 'No license here',
	homepage: 'https://example.com/no-license',
	name: 'no-license',
	version: '1.0.0',
})

const noHomepage = createRegistryFixture({
	bin: { 'no-homepage': 'cli.js' },
	description: 'No homepage here',
	license: 'MIT',
	name: 'no-homepage',
	repository: 'git@github.com:example/no-homepage.git',
	version: '1.0.0',
})

const badIntegrity = createRegistryFixture({
	bin: { 'bad-integrity': 'cli.js' },
	description: 'Corrupt',
	homepage: 'https://example.com',
	integrity:
		'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
	name: 'bad-integrity',
	version: '1.0.0',
})

const shasumOnly = createRegistryFixture({
	bin: { 'shasum-only': 'cli.js' },
	description: 'Old school',
	homepage: 'https://example.com',
	integrity: undefined,
	name: 'shasum-only',
	version: '1.0.0',
})

const bare = createRegistryFixture({
	bin: { bare: 'cli.js' },
	description: 'Nothing to link to',
	name: 'bare',
	version: '1.0.0',
})

const macArm = createRegistryFixture({
	bin: { 'mac-arm': 'cli.js' },
	description: 'Apple Silicon only',
	homepage: 'https://example.com/mac-arm',
	license: 'MIT',
	name: 'mac-arm',
	version: '1.0.0',
})

const noIntegrity = createRegistryFixture({
	bin: { 'no-integrity': 'cli.js' },
	description: 'No checks at all',
	homepage: 'https://example.com',
	integrity: undefined,
	name: 'no-integrity',
	shasum: undefined,
	version: '1.0.0',
})

/** All fixtures, keyed by `name@version`. */
export const registryFixtures: Record<string, RegistryFixture> = {}
for (const fixture of [
	fooBar,
	scopedFooBar,
	noBin,
	noLicense,
	noHomepage,
	badIntegrity,
	shasumOnly,
	noIntegrity,
	bare,
	macArm,
]) {
	registryFixtures[`${String(fixture.manifest.name)}@${String(fixture.manifest.version)}`] = fixture
}
