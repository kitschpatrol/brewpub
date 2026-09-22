import { describe, expect, it } from 'vitest'
import { renderFormula } from '../src/lib'
import { fooBarFormula } from './mocks/fixtures/formulas'
import { fooBar } from './mocks/fixtures/registry'

const baseInput = {
	binName: 'foo-bar',
	description: 'Command-line tool for doing things',
	formulaName: 'foo-bar',
	homepage: 'https://github.com/example/foo-bar',
	license: 'MIT',
	sha256: fooBar.sha256,
	url: fooBar.tarballUrl,
}

describe('renderFormula', () => {
	it('matches the brew create --node shape exactly', () => {
		expect(renderFormula(baseInput)).toBe(fooBarFormula)
	})

	it('omits the license stanza when there is no license', () => {
		const formula = renderFormula({ ...baseInput, license: undefined })
		expect(formula).not.toContain('license')
		expect(formula).toContain('sha256 "' + fooBar.sha256 + '"\n\n  depends_on "node"')
	})

	it('escapes Ruby string contents', () => {
		const formula = renderFormula({
			...baseInput,
			description: String.raw`Quotes "here" and #{interpolation} and #$global and a \ backslash`,
		})
		expect(formula).toContain(
			String.raw`desc "Quotes \"here\" and \#{interpolation} and \#$global and a \\ backslash"`,
		)
	})

	it('symlinks only the named bin when binOnly is set', () => {
		expect(renderFormula(baseInput)).toContain('bin.install_symlink libexec.glob("bin/*")')

		const formula = renderFormula({ ...baseInput, binName: 'fb', binOnly: true })
		expect(formula).toContain('bin.install_symlink libexec/"bin/fb"')
		expect(formula).not.toContain('libexec.glob')
	})

	it('uses the bin name in the test block and the class name from the formula name', () => {
		const formula = renderFormula({
			...baseInput,
			binName: 'fb',
			formulaName: 'scoped-thing',
			url: 'https://registry.npmjs.org/@scope/scoped-thing/-/scoped-thing-2.0.0.tgz',
		})
		expect(formula).toContain('class ScopedThing < Formula')
		expect(formula).toContain('shell_output("#{bin}/fb --version")')
		expect(formula).toContain(
			'url "https://registry.npmjs.org/@scope/scoped-thing/-/scoped-thing-2.0.0.tgz"',
		)
	})

	it('adds platform constraints before the node dependency', () => {
		const formula = renderFormula({ ...baseInput, arch: 'arm64', os: 'macos' })
		expect(formula).toContain(
			'  depends_on arch: :arm64\n  depends_on :macos\n  depends_on "node"\n\n  def install',
		)

		const linuxOnly = renderFormula({ ...baseInput, os: 'linux' })
		expect(linuxOnly).toContain('  depends_on :linux\n  depends_on "node"\n\n  def install')
		expect(linuxOnly).not.toContain('arch:')
	})

	it('ends with a single trailing newline', () => {
		const formula = renderFormula(baseInput)
		expect(formula.endsWith('end\n')).toBe(true)
		expect(formula.endsWith('end\n\n')).toBe(false)
	})
})
