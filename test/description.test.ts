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
