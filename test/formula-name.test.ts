import { describe, expect, it } from 'vitest'
import { getFormulaClassName, getFormulaName, isValidFormulaName } from '../src/lib'

const CANNOT_DERIVE = /Cannot derive a Homebrew formula name/v

describe('getFormulaName', () => {
	it.each([
		['foo-bar', 'foo-bar'],
		['@scope/foo-bar', 'foo-bar'],
		['@kitschpatrol/shared-config', 'shared-config'],
		['FooBar', 'foobar'],
		['node@20', 'node@20'],
	])('derives %s → %s', (packageName, expected) => {
		expect(getFormulaName(packageName)).toBe(expected)
	})

	it('rejects names that are not valid formula names', () => {
		expect(() => getFormulaName('foo bar')).toThrow(CANNOT_DERIVE)
		expect(() => getFormulaName('')).toThrow()
	})
})

describe('isValidFormulaName', () => {
	it.each([
		['foo', true],
		['foo-bar', true],
		['foo_bar.baz+qux', true],
		['node@20', true],
		['Foo', false],
		['foo bar', false],
		['foo/bar', false],
		['', false],
	])('%s → %s', (name, expected) => {
		expect(isValidFormulaName(name)).toBe(expected)
	})
})

describe('getFormulaClassName', () => {
	it.each([
		['foo', 'Foo'],
		['foo-bar', 'FooBar'],
		['foo_bar.baz', 'FooBarBaz'],
		['fooBar', 'Foobar'],
		['c++', 'Cxx'],
		['node@20', 'NodeAT20'],
		['a b', 'AB'],
		['foo-bar2', 'FooBar2'],
		['x264', 'X264'],
	])('%s → %s', (formulaName, expected) => {
		expect(getFormulaClassName(formulaName)).toBe(expected)
	})
})
