import { describe, expect, it } from 'vitest'
import { normalizeDescription } from '../src/lib'

const NO_DESCRIPTION = /no usable description/v
const TOO_LONG = /81 characters/v

describe('normalizeDescription', () => {
	it.each([
		['A command line tool for doing things.', 'Command-line tool for doing things'],
		['An elegant thing', 'Elegant thing'],
		['the thing', 'Thing'],
		['lowercase start', 'Lowercase start'],
		['Uses the commandline heavily', 'Uses the command-line heavily'],
		['Command Line stuff', 'Command-line stuff'],
		['Supports foo, bar, etc.', 'Supports foo, bar, etc.'],
		['Fun with emoji 🎉 inside', 'Fun with emoji inside'],
		['  padded   with   spaces  ', 'Padded with spaces'],
		['iOS helper.', 'iOS helper'],
		['macOS helper', 'macOS helper'],
		['Theatre booking', 'Theatre booking'],
		['Android tools', 'Android tools'],
	])('%j → %j', (input, expected) => {
		expect(normalizeDescription(input).description).toBe(expected)
	})

	it.each([
		['foo-bar', 'foo-bar - Markdown things', 'Markdown things'],
		['foo-bar', 'Foo Bar: does things', 'Does things'],
		['foo-bar', 'foobar does things', 'Does things'],
		['foo-bar', 'FooBarrier is unrelated', 'FooBarrier is unrelated'],
		['mdat', 'mdat: a Markdown template tool', 'Markdown template tool'],
	])('strips the formula name %s from %j', (formulaName, input, expected) => {
		expect(normalizeDescription(input, { formulaName }).description).toBe(expected)
	})

	it.each([
		[
			'CLI tool to publish and update Homebrew formula to your custom tap. Like npm publish for Homebrew.',
			'Publish and update Homebrew formula to your custom tap',
		],
		[
			'CLI tool and TypeScript library implementing the Markdown Autophagic Template (MDAT) system. MDAT lets you use comments as dynamic content templates in Markdown files, making it easy to generate and update readme boilerplate.',
			'Markdown Autophagic Template (MDAT) system',
		],
		['A CLI tool for managing things', 'Managing things'],
		['A CLI tool and library for parsing things', 'Parsing things'],
		['Library tool to do things', 'Do things'],
		['CLI tool for the command line', 'Command-line'],
		['CLI tools for many things', 'CLI tools for many things'],
		['Toolkit for things', 'Toolkit for things'],
		['CLI tool', 'CLI tool'],
		['CLI tool format converter', 'CLI tool format converter'],
	])('strips tool boilerplate from %j', (input, expected) => {
		expect(normalizeDescription(input).description).toBe(expected)
	})

	it.each([
		['First sentence. Second sentence.', 'First sentence'],
		['Works with Node.js apps. Really well', 'Works with Node.js apps'],
		['Handles e.g. foo and bar', 'Handles e.g. foo and bar'],
		['Supports foo, bar, etc. Also baz', 'Supports foo, bar, etc.'],
		['Version 1.2 tool. Really', 'Version 1.2 tool'],
		['No sentence break here', 'No sentence break here'],
		['Ends with a period.', 'Ends with a period'],
	])('keeps only the first sentence of %j', (input, expected) => {
		expect(normalizeDescription(input).description).toBe(expected)
	})

	it('does not warn about length when the first sentence fits', () => {
		const result = normalizeDescription(`${'A'.repeat(70)}. ${'B'.repeat(70)}`)
		expect(result.description).toBe('A'.repeat(70))
		expect(result.warnings).toEqual([])
	})

	it('throws when nothing is left', () => {
		expect(() => normalizeDescription('')).toThrow(NO_DESCRIPTION)
		expect(() => normalizeDescription('foo', { formulaName: 'foo' })).toThrow(NO_DESCRIPTION)
	})

	it('warns when the description is too long', () => {
		const long = 'A'.repeat(81)
		const result = normalizeDescription(long)
		expect(result.description).toBe(long)
		expect(result.warnings).toHaveLength(1)
		expect(result.warnings[0]).toMatch(TOO_LONG)
	})

	it('does not warn at exactly 80 characters', () => {
		const result = normalizeDescription('A'.repeat(80))
		expect(result.warnings).toHaveLength(0)
	})
})
