import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { getPackageRelease } from '../src/lib'
import { fooBar, scopedFooBar } from './mocks/fixtures/registry'
import { server } from './mocks/server'

const SHA512 = /^sha512-/v
const TIMED_OUT = /Timed out waiting for foo-bar@1\.2\.3/v
const HTTP_401 = /HTTP 401/v
const INTEGRITY_MISMATCH = /Integrity mismatch/v
const SHA1_ONLY = /SHA-1 only/v
const NO_INTEGRITY = /no integrity data/v
const WRONG_PACKAGE = /Registry returned @scope\/foo-bar@2\.0\.0/v
const NO_DIST = /no "dist"/v

const fastRetry = { initialDelayMs: 1, maxDelayMs: 2, timeoutMs: 5000 }
const manifestUrl = 'https://registry.npmjs.org/foo-bar/1.2.3'

function recordRequestUrls(): { stop: () => void; urls: string[] } {
	const urls: string[] = []
	const listener = ({ request }: { request: Request }) => {
		urls.push(request.url)
	}

	server.events.on('request:start', listener)
	return {
		stop() {
			server.events.removeListener('request:start', listener)
		},
		urls,
	}
}

describe('getPackageRelease', () => {
	it('resolves a published version to its tarball and verified sha256', async () => {
		const release = await getPackageRelease('foo-bar', '1.2.3')

		expect(release).toMatchObject({
			binNames: ['foo-bar', 'foo-bar-extra'],
			description: 'A command line tool for doing things.',
			homepage: 'https://github.com/example/foo-bar',
			integrity: expect.stringMatching(SHA512) as string,
			license: 'MIT',
			name: 'foo-bar',
			repoUrl: 'https://github.com/example/foo-bar',
			sha256: fooBar.sha256,
			tarballUrl: fooBar.tarballUrl,
			version: '1.2.3',
			warnings: [],
		})
	})

	it('encodes scoped package names and reads string bin, object license, and shorthand repository', async () => {
		const recorder = recordRequestUrls()
		const release = await getPackageRelease('@scope/foo-bar', '2.0.0')
		recorder.stop()

		expect(recorder.urls[0]).toBe('https://registry.npmjs.org/@scope%2Ffoo-bar/2.0.0')
		expect(release).toMatchObject({
			binNames: ['foo-bar'],
			license: 'ISC',
			repoUrl: 'https://github.com/scope/foo-bar',
			sha256: scopedFooBar.sha256,
			tarballUrl: 'https://registry.npmjs.org/@scope/foo-bar/-/foo-bar-2.0.0.tgz',
		})
	})

	it('tolerates a trailing slash on the registry url', async () => {
		const release = await getPackageRelease('foo-bar', '1.2.3', {
			registryUrl: 'https://registry.npmjs.org/',
		})
		expect(release.sha256).toBe(fooBar.sha256)
	})

	it('returns an empty bin list for packages without executables', async () => {
		const release = await getPackageRelease('no-bin', '1.0.0')
		expect(release.binNames).toEqual([])
	})

	it('retries while the registry returns 404 for a fresh publish', async () => {
		let attempts = 0
		server.use(
			http.get(manifestUrl, () => {
				attempts++
				return attempts < 3
					? HttpResponse.json({ error: 'version not found' }, { status: 404 })
					: HttpResponse.json(fooBar.manifest)
			}),
		)

		const release = await getPackageRelease('foo-bar', '1.2.3', fastRetry)
		expect(attempts).toBe(3)
		expect(release.sha256).toBe(fooBar.sha256)
	})

	it('retries on server errors', async () => {
		let attempts = 0
		server.use(
			http.get(manifestUrl, () => {
				attempts++
				return attempts === 1
					? HttpResponse.json({}, { status: 503 })
					: HttpResponse.json(fooBar.manifest)
			}),
		)

		await getPackageRelease('foo-bar', '1.2.3', fastRetry)
		expect(attempts).toBe(2)
	})

	it('retries a tarball that is not yet available', async () => {
		let attempts = 0
		server.use(
			http.get(fooBar.tarballUrl, () => {
				attempts++
				return attempts === 1
					? HttpResponse.json({}, { status: 404 })
					: HttpResponse.arrayBuffer(fooBar.tarballBytes.buffer as ArrayBuffer)
			}),
		)

		const release = await getPackageRelease('foo-bar', '1.2.3', fastRetry)
		expect(attempts).toBe(2)
		expect(release.sha256).toBe(fooBar.sha256)
	})

	it('gives up after the timeout', async () => {
		server.use(http.get(manifestUrl, () => HttpResponse.json({}, { status: 404 })))

		await expect(
			getPackageRelease('foo-bar', '1.2.3', { initialDelayMs: 5, maxDelayMs: 10, timeoutMs: 30 }),
		).rejects.toThrow(TIMED_OUT)
	})

	it('fails immediately on non-retryable client errors', async () => {
		let attempts = 0
		server.use(
			http.get(manifestUrl, () => {
				attempts++
				return HttpResponse.json({}, { status: 401 })
			}),
		)

		await expect(getPackageRelease('foo-bar', '1.2.3', fastRetry)).rejects.toThrow(HTTP_401)
		expect(attempts).toBe(1)
	})

	it('rejects a tarball that does not match the registry integrity', async () => {
		await expect(getPackageRelease('bad-integrity', '1.0.0')).rejects.toThrow(INTEGRITY_MISMATCH)
	})

	it('falls back to shasum with a warning', async () => {
		const release = await getPackageRelease('shasum-only', '1.0.0')
		expect(release.warnings).toEqual([expect.stringMatching(SHA1_ONLY)])
	})

	it('warns when the registry provides no integrity data at all', async () => {
		const release = await getPackageRelease('no-integrity', '1.0.0')
		expect(release.warnings).toEqual([expect.stringMatching(NO_INTEGRITY)])
	})

	it('rejects a manifest for a different package or version', async () => {
		server.use(http.get(manifestUrl, () => HttpResponse.json(scopedFooBar.manifest)))
		await expect(getPackageRelease('foo-bar', '1.2.3', fastRetry)).rejects.toThrow(WRONG_PACKAGE)
	})

	it('rejects a manifest without dist information', async () => {
		server.use(
			http.get(manifestUrl, () => HttpResponse.json({ name: 'foo-bar', version: '1.2.3' })),
		)
		await expect(getPackageRelease('foo-bar', '1.2.3', fastRetry)).rejects.toThrow(NO_DIST)
	})
})
