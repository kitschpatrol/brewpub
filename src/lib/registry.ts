import { createHash } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { getFormulaName } from './formula/name'
import { log } from './log'
import { normalizeRepoUrl } from './utilities/repo-url'

/** The public npm registry. */
export const DEFAULT_REGISTRY_URL = 'https://registry.npmjs.org'

/**
 * Options for {@link getPackageRelease}.
 */
export type GetPackageReleaseOptions = {
	/**
	 * First retry delay when the registry hasn't caught up yet. Doubles each
	 * attempt.
	 */
	initialDelayMs?: number | undefined
	/** Upper bound for the retry delay. */
	maxDelayMs?: number | undefined
	registryUrl?: string | undefined
	signal?: AbortSignal | undefined
	/** Give up waiting for the registry after this long. */
	timeoutMs?: number | undefined
}

/** Defaults for {@link getPackageRelease}. */
export const DEFAULT_GET_PACKAGE_RELEASE_OPTIONS = {
	initialDelayMs: 1000,
	maxDelayMs: 15_000,
	registryUrl: DEFAULT_REGISTRY_URL,
	timeoutMs: 300_000,
} satisfies GetPackageReleaseOptions

/**
 * Everything a formula needs to know about one published version of a package.
 */
export type PackageRelease = {
	/** Executable names from the package's `bin` field, in declaration order. */
	binNames: string[]
	description: string | undefined
	homepage: string | undefined
	/** SRI (subresource integrity) string from the registry, e.g. `sha512-…`. */
	integrity: string | undefined
	/** SPDX license expression as published. */
	license: string | undefined
	name: string
	/** Repository URL normalized to `https`. */
	repoUrl: string | undefined
	/** Hex SHA-256 of the tarball, verified against the registry's integrity data. */
	sha256: string
	tarballUrl: string
	version: string
	/** Problems that didn't prevent a result. */
	warnings: string[]
}

type RegistryManifest = {
	binNames: string[]
	description: string | undefined
	homepage: string | undefined
	integrity: string | undefined
	license: string | undefined
	name: string
	repoUrl: string | undefined
	shasum: string | undefined
	tarballUrl: string
	version: string
}

const RETRYABLE_STATUSES = new Set([404, 408, 425, 429])
const WHITESPACE = /\s+/v
const TRAILING_SLASHES = /\/+$/v
const SRI_ALGORITHMS = ['sha512', 'sha384', 'sha256'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
	const value = record[key]
	return typeof value === 'string' && value !== '' ? value : undefined
}

function getLicense(value: unknown): string | undefined {
	if (typeof value === 'string') {
		return value === '' ? undefined : value
	}

	return isRecord(value) ? getString(value, 'type') : undefined
}

function getRepoUrl(value: unknown): string | undefined {
	const raw =
		typeof value === 'string' ? value : isRecord(value) ? getString(value, 'url') : undefined
	return raw === undefined ? undefined : normalizeRepoUrl(raw)
}

function getBinNames(value: unknown, packageName: string): string[] {
	if (typeof value === 'string') {
		return [getFormulaName(packageName)]
	}

	return isRecord(value) ? Object.keys(value) : []
}

function parseManifest(data: unknown, name: string, version: string): RegistryManifest {
	if (!isRecord(data)) {
		throw new TypeError(`Unexpected registry response for ${name}@${version}: not a JSON object.`)
	}

	const { dist } = data
	if (!isRecord(dist)) {
		throw new TypeError(`Registry manifest for ${name}@${version} has no "dist" field.`)
	}

	const tarballUrl = getString(dist, 'tarball')
	if (tarballUrl === undefined) {
		throw new TypeError(`Registry manifest for ${name}@${version} has no tarball URL.`)
	}

	const manifestName = getString(data, 'name') ?? name
	const manifestVersion = getString(data, 'version') ?? version
	if (manifestName !== name || manifestVersion !== version) {
		throw new Error(
			`Registry returned ${manifestName}@${manifestVersion} when ${name}@${version} was requested.`,
		)
	}

	return {
		binNames: getBinNames(data.bin, name),
		description: getString(data, 'description'),
		homepage: getString(data, 'homepage'),
		integrity: getString(dist, 'integrity'),
		license: getLicense(data.license),
		name,
		repoUrl: getRepoUrl(data.repository),
		shasum: getString(dist, 'shasum'),
		tarballUrl,
		version,
	}
}

type FetchWithRetryOptions = {
	accept: string
	deadline: number
	description: string
	initialDelayMs: number
	maxDelayMs: number
	signal: AbortSignal | undefined
}

type AttemptOutcome = { error: unknown } | { response: Response }

async function attemptFetch(
	url: string,
	accept: string,
	signal: AbortSignal | undefined,
): Promise<AttemptOutcome> {
	try {
		const response = await fetch(url, { headers: { accept }, ...(signal && { signal }) })
		return { response }
	} catch (error) {
		return { error }
	}
}

function isRetryableStatus(status: number): boolean {
	return RETRYABLE_STATUSES.has(status) || status >= 500
}

/**
 * Fetch a URL, retrying with exponential backoff while the registry catches up
 * with a fresh publish (404s, rate limits, server errors, network errors).
 */
async function fetchWithRetry(url: string, options: FetchWithRetryOptions): Promise<Response> {
	let delay = options.initialDelayMs
	let hasLoggedWaiting = false

	for (;;) {
		const outcome = await attemptFetch(url, options.accept, options.signal)
		let failureReason: string

		if ('response' in outcome) {
			if (outcome.response.ok) {
				return outcome.response
			}

			void outcome.response.body?.cancel()

			if (!isRetryableStatus(outcome.response.status)) {
				throw new Error(
					`Request for ${options.description} failed with HTTP ${outcome.response.status} (${url}).`,
				)
			}

			failureReason = `HTTP ${outcome.response.status}`
		} else {
			if (options.signal?.aborted) {
				throw outcome.error instanceof Error ? outcome.error : new Error(String(outcome.error))
			}

			failureReason = outcome.error instanceof Error ? outcome.error.message : String(outcome.error)
		}

		if (Date.now() + delay > options.deadline) {
			throw new Error(
				`Timed out waiting for ${options.description} (${url}). Last failure: ${failureReason}. Check that the publish succeeded, or raise the timeout.`,
			)
		}

		if (!hasLoggedWaiting) {
			log.info(`Waiting for ${options.description} to become available on the registry...`)
			hasLoggedWaiting = true
		}

		log.debug(`${options.description}: ${failureReason}, retrying in ${delay} ms`)
		await sleep(delay, undefined, options.signal ? { signal: options.signal } : {})
		delay = Math.min(delay * 2, options.maxDelayMs)
	}
}

function verifyTarball(
	bytes: Uint8Array,
	integrity: string | undefined,
	shasum: string | undefined,
	tarballUrl: string,
): string[] {
	const warnings: string[] = []

	if (integrity !== undefined) {
		for (const algorithm of SRI_ALGORITHMS) {
			const expected = integrity
				.split(WHITESPACE)
				.find((entry) => entry.startsWith(`${algorithm}-`))
				?.slice(algorithm.length + 1)

			if (expected === undefined) {
				continue
			}

			const actual = createHash(algorithm).update(bytes).digest('base64')
			if (actual !== expected) {
				throw new Error(
					`Integrity mismatch for ${tarballUrl}: the downloaded tarball does not match the registry's ${algorithm} integrity value. The registry may still be propagating the publish; try again.`,
				)
			}

			return warnings
		}

		warnings.push(`Registry integrity value uses an unsupported algorithm: ${integrity}`)
	}

	if (shasum !== undefined) {
		const actual = createHash('sha1').update(bytes).digest('hex')
		if (actual !== shasum) {
			throw new Error(
				`Integrity mismatch for ${tarballUrl}: the downloaded tarball does not match the registry's shasum.`,
			)
		}

		warnings.push(
			'Tarball verified with SHA-1 only; the registry provided no stronger integrity value.',
		)
		return warnings
	}

	warnings.push('The registry provided no integrity data, so the tarball could not be verified.')
	return warnings
}

/**
 * Encode a package name for use in a registry URL path (`@scope/name` →
 * `@scope%2Fname`).
 */
function encodePackageName(name: string): string {
	return name.replace('/', '%2F')
}

/**
 * Resolve a published package version to its tarball URL and SHA-256, waiting
 * for the registry to catch up if the version was published moments ago.
 *
 * The tarball is downloaded and verified against the registry's integrity value
 * before hashing, so the returned SHA-256 matches exactly what Homebrew will
 * download.
 */
export async function getPackageRelease(
	name: string,
	version: string,
	options: GetPackageReleaseOptions = {},
): Promise<PackageRelease> {
	const initialDelayMs =
		options.initialDelayMs ?? DEFAULT_GET_PACKAGE_RELEASE_OPTIONS.initialDelayMs
	const maxDelayMs = options.maxDelayMs ?? DEFAULT_GET_PACKAGE_RELEASE_OPTIONS.maxDelayMs
	const registryUrl = (
		options.registryUrl ?? DEFAULT_GET_PACKAGE_RELEASE_OPTIONS.registryUrl
	).replace(TRAILING_SLASHES, '')
	const timeoutMs = options.timeoutMs ?? DEFAULT_GET_PACKAGE_RELEASE_OPTIONS.timeoutMs
	const deadline = Date.now() + timeoutMs
	const retryOptions = { deadline, initialDelayMs, maxDelayMs, signal: options.signal }

	const manifestUrl = `${registryUrl}/${encodePackageName(name)}/${version}`
	log.debug(`Fetching manifest ${manifestUrl}`)
	const manifestResponse = await fetchWithRetry(manifestUrl, {
		...retryOptions,
		accept: 'application/json',
		description: `${name}@${version}`,
	})
	const manifest = parseManifest(await manifestResponse.json(), name, version)

	log.debug(`Downloading tarball ${manifest.tarballUrl}`)
	const tarballResponse = await fetchWithRetry(manifest.tarballUrl, {
		...retryOptions,
		accept: 'application/octet-stream',
		description: `${name}@${version} tarball`,
	})
	const bytes = new Uint8Array(await tarballResponse.arrayBuffer())
	const warnings = verifyTarball(bytes, manifest.integrity, manifest.shasum, manifest.tarballUrl)
	const sha256 = createHash('sha256').update(bytes).digest('hex')
	log.debug(`Tarball is ${bytes.byteLength} bytes, sha256 ${sha256}`)

	return {
		binNames: manifest.binNames,
		description: manifest.description,
		homepage: manifest.homepage,
		integrity: manifest.integrity,
		license: manifest.license,
		name,
		repoUrl: manifest.repoUrl,
		sha256,
		tarballUrl: manifest.tarballUrl,
		version,
		warnings,
	}
}
