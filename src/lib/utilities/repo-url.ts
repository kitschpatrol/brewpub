const GIT_PREFIX = /^git\+/v
const GIT_SUFFIX = /\.git$/v
const TRAILING_SLASH = /\/+$/v
const SCP_LIKE = /^(?:[\w.\-]+@)?(?<host>[\w.\-]+):(?<path>[^\/].*)$/v
const SHORTHAND = /^(?<host>github|gitlab|bitbucket):(?<path>.+)$/v
const SUPPORTED_SCHEME = /^(?:git\+ssh|git|http|https|ssh):\/\//iv

const SHORTHAND_HOSTS: Record<string, string> = {
	bitbucket: 'bitbucket.org',
	github: 'github.com',
	gitlab: 'gitlab.com',
}

/**
 * Normalize a `package.json` repository URL or git remote URL to a plain
 * `https` URL suitable for a formula `homepage`.
 *
 * Handles `git+https://…`, `git+ssh://git@host/o/r.git`, `git@host:o/r.git`,
 * `ssh://git@host/o/r`, `git://host/o/r`, `github:o/r` shorthand, and trailing
 * `.git`. Returns `undefined` when the value can't be parsed.
 */
export function normalizeRepoUrl(url: string): string | undefined {
	let candidate = url.trim().replace(GIT_PREFIX, '')

	const shorthand = SHORTHAND.exec(candidate)?.groups
	if (shorthand?.host !== undefined && shorthand.path !== undefined) {
		candidate = `https://${SHORTHAND_HOSTS[shorthand.host] ?? ''}/${shorthand.path}`
	}

	const scpLike = SCP_LIKE.exec(candidate)?.groups
	if (scpLike?.host !== undefined && scpLike.path !== undefined && !candidate.includes('://')) {
		candidate = `https://${scpLike.host}/${scpLike.path}`
	}

	// The URL parser can't switch a non-special scheme like `ssh:` to `https:`,
	// so swap the scheme textually before parsing.
	if (!SUPPORTED_SCHEME.test(candidate)) {
		return undefined
	}

	let parsed: URL
	try {
		parsed = new URL(candidate.replace(SUPPORTED_SCHEME, 'https://'))
	} catch {
		return undefined
	}

	parsed.username = ''
	parsed.password = ''
	parsed.search = ''
	parsed.hash = ''

	const pathname = parsed.pathname.replace(GIT_SUFFIX, '').replace(TRAILING_SLASH, '')
	return pathname === '' || parsed.hostname === '' ? undefined : `${parsed.origin}${pathname}`
}
