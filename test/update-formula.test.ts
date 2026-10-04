import { describe, expect, it } from 'vitest'
import { getVersionFromFormulaUrl, updateFormula } from '../src/lib'
import { fooBarFormulaWithBottle, fooBarFormulaWithBottleCurrent } from './mocks/fixtures/formulas'
import { fooBar } from './mocks/fixtures/registry'

const URL_LINE = /^ {2}url .*\n/mv
const SHA256_LINE = /^ {2}sha256 .*\n/mv
const URL_AND_SHA256_LINES = /^ {2}url .*\n {2}sha256 .*\n/mv
const MISSING_URL = /top-level `url` stanza/v
const MISSING_SHA256 = /top-level `sha256` stanza/v
const MISSING_DESC = /top-level `desc` stanza/v
const DESC_LINE = /^ {2}desc .*\n/mv

const current = {
	description: 'Command-line tool for doing things',
	sha256: fooBar.sha256,
	url: fooBar.tarballUrl,
}

describe('updateFormula', () => {
	it('changes only the top-level url and sha256 lines when the desc is current', () => {
		const result = updateFormula(fooBarFormulaWithBottle, current)

		expect(result.isChanged).toBe(true)
		expect(result.previousUrl).toBe('https://registry.npmjs.org/foo-bar/-/foo-bar-1.2.2.tgz')
		expect(result.previousVersion).toBe('1.2.2')
		expect(result.previousSha256).toBe('0'.repeat(64))
		expect(result.content).toBe(fooBarFormulaWithBottleCurrent)

		const before = fooBarFormulaWithBottle.split('\n')
		const after = result.content.split('\n')
		expect(after).toHaveLength(before.length)
		const changed = before.filter((line, index) => line !== after[index])
		expect(changed).toEqual([
			'  url "https://registry.npmjs.org/foo-bar/-/foo-bar-1.2.2.tgz"',
			'  sha256 "0000000000000000000000000000000000000000000000000000000000000000"',
		])
	})

	it('reports no change when the formula is already current', () => {
		const result = updateFormula(fooBarFormulaWithBottleCurrent, current)
		expect(result.isChanged).toBe(false)
		expect(result.content).toBe(fooBarFormulaWithBottleCurrent)
	})

	it('preserves trailing arguments on the url stanza', () => {
		const formula = fooBarFormulaWithBottle.replace(
			'foo-bar-1.2.2.tgz"',
			'foo-bar-1.2.2.tgz", using: :nounzip',
		)
		const result = updateFormula(formula, current)
		expect(result.content).toContain(`  url "${fooBar.tarballUrl}", using: :nounzip`)
	})

	it('replaces a changed desc, escaping it for Ruby', () => {
		const result = updateFormula(fooBarFormulaWithBottleCurrent, {
			...current,
			description: 'Turn "#{comments}" into content',
		})
		expect(result.isChanged).toBe(true)
		expect(result.content).toBe(
			fooBarFormulaWithBottleCurrent.replace(
				'desc "Command-line tool for doing things"',
				String.raw`desc "Turn \"\#{comments}\" into content"`,
			),
		)
	})

	it('treats an escaped desc that matches as current', () => {
		const description = 'Say "hi"'
		const formula = fooBarFormulaWithBottleCurrent.replace(
			'desc "Command-line tool for doing things"',
			String.raw`desc "Say \"hi\""`,
		)
		expect(updateFormula(formula, { ...current, description }).isChanged).toBe(false)
	})

	it('throws when the desc stanza is missing', () => {
		const formula = fooBarFormulaWithBottle.replace(DESC_LINE, '')
		expect(() => updateFormula(formula, current)).toThrow(MISSING_DESC)
	})

	it('throws when the url stanza is missing', () => {
		const formula = fooBarFormulaWithBottle.replace(URL_LINE, '')
		expect(() => updateFormula(formula, current)).toThrow(MISSING_URL)
	})

	it('throws when the sha256 stanza is missing', () => {
		const formula = fooBarFormulaWithBottle.replace(SHA256_LINE, '')
		expect(() => updateFormula(formula, current)).toThrow(MISSING_SHA256)
	})

	it('ignores indented url and sha256 lines inside blocks', () => {
		const formula = fooBarFormulaWithBottle.replace(URL_AND_SHA256_LINES, '')
		expect(() => updateFormula(formula, current)).toThrow()
	})
})

describe('getVersionFromFormulaUrl', () => {
	it.each([
		['https://registry.npmjs.org/foo/-/foo-1.2.3.tgz', '1.2.3'],
		['https://registry.npmjs.org/@scope/foo-bar/-/foo-bar-10.0.1.tgz', '10.0.1'],
		['https://registry.npmjs.org/foo/-/foo-1.0.0-beta.2.tgz', '1.0.0-beta.2'],
		['https://registry.npmjs.org/foo-2/-/foo-2-1.2.3.tgz', '1.2.3'],
		['https://github.com/example/foo/archive/refs/tags/v1.2.3.tar.gz', undefined],
	])('%s → %s', (url, expected) => {
		expect(getVersionFromFormulaUrl(url)).toBe(expected)
	})
})
