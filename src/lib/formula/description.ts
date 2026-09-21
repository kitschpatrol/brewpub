// Mirrors the checks in Homebrew's `Library/Homebrew/rubocops/shared/desc_helper.rb` so that
// generated formulae pass `brew audit` without manual edits.

import { log } from '../log'

const MAX_DESCRIPTION_LENGTH = 80
const LOWERCASE_ALLOWED_FIRST_WORDS = new Set(['iOS', 'iPhone', 'macOS'])
const LEADING_ARTICLE = /^(?:the|an?)\s+/iv
// Boilerplate like "CLI tool to …" or "CLI tool and TypeScript library implementing the …"
// that npm descriptions tend to open with, but that wastes Homebrew's 80 characters.
const LEADING_TOOL_PHRASE =
	/^(?:a )?(?:cli|library) tool(?: and (?:typescript )?library)? (?:to|for|implementing(?: the)?)\b\s*/iv
const COMMAND_LINE = /command ?line/giv
// A period followed by whitespace and a capital letter, so "Node.js" and "e.g. foo" don't count.
const SENTENCE_BREAK = /\.\s+(?=[A-Z])/v
const TRAILING_FULL_STOP = /\.$/v
const STARTS_LOWERCASE = /^[a-z]/v
const SYMBOLS = /\s?\p{So}/gv
const WHITESPACE = /\s+/gv

/**
 * A description ready for a formula's `desc` stanza, plus any problems that
 * couldn't be fixed automatically.
 */
export type NormalizeDescriptionResult = {
	description: string
	warnings: string[]
}

function getLeadingNameRegex(formulaName: string): RegExp {
	const pattern = Array.from(formulaName.replaceAll('-', ''), (character) =>
		RegExp.escape(character),
	)
	return new RegExp(String.raw`^${pattern.join(String.raw`[\s\-]?`)}\b[\s:\-]*`, 'iv')
}

/**
 * Normalize an npm package description into something Homebrew's `desc` audit
 * accepts: no leading article, no leading formula name, no leading "CLI tool to
 * …" boilerplate, first sentence only, capitalized, spelled `command-line`, no
 * trailing full stop, no emoji.
 *
 * Over-long descriptions are returned as-is with a warning, since truncation
 * would be lossy.
 *
 * @throws {Error} When nothing is left after normalization.
 */
export function normalizeDescription(
	text: string,
	options: { formulaName?: string | undefined } = {},
): NormalizeDescriptionResult {
	const warnings: string[] = []

	let description = text.replaceAll(SYMBOLS, '').replaceAll(WHITESPACE, ' ').trim()

	if (options.formulaName !== undefined) {
		description = description.replace(getLeadingNameRegex(options.formulaName), '')
	}

	description = description
		.replace(LEADING_TOOL_PHRASE, '')
		.replace(LEADING_ARTICLE, '')
		.replaceAll(COMMAND_LINE, (match) => (match.startsWith('C') ? 'Command-line' : 'command-line'))

	const sentenceBreakIndex = description.search(SENTENCE_BREAK)
	if (sentenceBreakIndex !== -1) {
		log.debug(`Keeping only the first sentence of the description: "${description}"`)
		description = description.slice(0, sentenceBreakIndex + 1)
	}

	if (!description.endsWith('etc.')) {
		description = description.replace(TRAILING_FULL_STOP, '')
	}

	description = description.trim()

	const firstWord = description.split(' ', 1)[0] ?? ''
	if (!LOWERCASE_ALLOWED_FIRST_WORDS.has(firstWord) && STARTS_LOWERCASE.test(description)) {
		description = description.charAt(0).toUpperCase() + description.slice(1)
	}

	if (description === '') {
		throw new Error(
			'The package has no usable description. Pass one explicitly with the "description" option.',
		)
	}

	if (description.length > MAX_DESCRIPTION_LENGTH) {
		warnings.push(
			`Description is ${description.length} characters, but Homebrew allows at most ${MAX_DESCRIPTION_LENGTH}. Pass a shorter one with the "description" option or \`brew audit\` will fail.`,
		)
	}

	return { description, warnings }
}
