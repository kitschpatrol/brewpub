import { toRubyString } from './render'

// Anchored to exactly two spaces of indentation so that `url` lines inside
// `livecheck do` blocks and `sha256 cellar:` lines inside `bottle do` blocks,
// which are indented four spaces, are never touched.
const DESC_STANZA = /^ {2}desc (?<literal>"(?:[^"\\]|\\.)*")[ \t]*$/mv
const URL_STANZA = /^ {2}url "(?<url>[^"]*)"(?<rest>[^\n]*)$/mv
const SHA256_STANZA = /^ {2}sha256 "(?<sha256>[0-9a-f]{64})"[ \t]*$/mv
const NPM_TARBALL_VERSION = /-(?<version>\d+\.\d+\.\d+(?:-[0-9A-Za-z.\-]+)?)\.tgz$/v

/**
 * Outcome of a surgical formula update.
 */
export type UpdateFormulaResult = {
	/**
	 * The updated formula source. Identical to the input when `isChanged` is
	 * false.
	 */
	content: string
	/** False when the formula already had the requested desc, url, and sha256. */
	isChanged: boolean
	previousSha256: string
	previousUrl: string
	/** Version parsed from the previous url, when it was an npm tarball url. */
	previousVersion: string | undefined
}

/**
 * Parse the package version from an npm registry tarball URL such as
 * `https://registry.npmjs.org/foo/-/foo-1.2.3.tgz`.
 */
export function getVersionFromFormulaUrl(url: string): string | undefined {
	return NPM_TARBALL_VERSION.exec(url)?.groups?.version
}

/**
 * Replace only the top-level `desc`, `url`, and `sha256` stanzas of an existing
 * formula, leaving bottle blocks, livecheck blocks, custom tests, and
 * everything else untouched.
 *
 * @throws {Error} When the formula has no top-level `desc`, `url`, or `sha256`
 *   stanza.
 */
export function updateFormula(
	existingRuby: string,
	next: { description: string; sha256: string; url: string },
): UpdateFormulaResult {
	const descMatch = DESC_STANZA.exec(existingRuby)
	if (descMatch?.groups === undefined) {
		throw new Error('Could not find a top-level `desc` stanza in the existing formula.')
	}

	const urlMatch = URL_STANZA.exec(existingRuby)
	if (urlMatch?.groups === undefined) {
		throw new Error('Could not find a top-level `url` stanza in the existing formula.')
	}

	const sha256Match = SHA256_STANZA.exec(existingRuby)
	if (sha256Match?.groups === undefined) {
		throw new Error('Could not find a top-level `sha256` stanza in the existing formula.')
	}

	const descLiteral = toRubyString(next.description)
	const previousUrl = urlMatch.groups.url ?? ''
	const previousSha256 = sha256Match.groups.sha256 ?? ''
	const previousVersion = getVersionFromFormulaUrl(previousUrl)

	if (
		descMatch.groups.literal === descLiteral &&
		previousUrl === next.url &&
		previousSha256 === next.sha256
	) {
		return {
			content: existingRuby,
			isChanged: false,
			previousSha256,
			previousUrl,
			previousVersion,
		}
	}

	const rest = urlMatch.groups.rest ?? ''
	const content = existingRuby
		.replace(DESC_STANZA, () => `  desc ${descLiteral}`)
		.replace(URL_STANZA, () => `  url "${next.url}"${rest}`)
		.replace(SHA256_STANZA, () => `  sha256 "${next.sha256}"`)

	return {
		content,
		isChanged: true,
		previousSha256,
		previousUrl,
		previousVersion,
	}
}
