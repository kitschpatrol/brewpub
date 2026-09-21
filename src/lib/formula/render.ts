import { getFormulaClassName } from './name'

/**
 * Everything needed to render a new Node formula.
 */
export type RenderFormulaInput = {
	/** Restrict the formula to one CPU architecture with `depends_on arch:`. */
	arch?: 'arm64' | 'x86_64' | undefined
	/** Name of the executable used by the formula's test block. */
	binName: string
	/** Formula description, already normalized for Homebrew's audit rules. */
	description: string
	/** Homebrew formula name, e.g. `foo-bar`. */
	formulaName: string
	homepage: string
	/** SPDX license identifier. Omitted from the formula when undefined. */
	license?: string | undefined
	/** Restrict the formula to one OS with `depends_on :macos` or `:linux`. */
	os?: 'linux' | 'macos' | undefined
	/** Hex SHA-256 of the tarball. */
	sha256: string
	/** Registry tarball URL. */
	url: string
}

const RUBY_ESCAPES = /[\\"]|#(?=[\{$@])/gv

/**
 * Escape text for use inside a Ruby double-quoted string literal.
 */
function escapeRubyString(text: string): string {
	return text.replaceAll(RUBY_ESCAPES, (match) => `\\${match}`)
}

/**
 * Render text as a Ruby double-quoted string literal, including the quotes.
 */
function toRubyString(text: string): string {
	return `"${escapeRubyString(text)}"`
}

/**
 * Render a complete Homebrew formula for an npm CLI package, in the shape
 * produced by `brew create --node`.
 */
export function renderFormula(input: RenderFormulaInput): string {
	const className = getFormulaClassName(input.formulaName)

	const lines = [
		`class ${className} < Formula`,
		`  desc ${toRubyString(input.description)}`,
		`  homepage ${toRubyString(input.homepage)}`,
		`  url ${toRubyString(input.url)}`,
		`  sha256 ${toRubyString(input.sha256)}`,
		...(input.license === undefined ? [] : [`  license ${toRubyString(input.license)}`]),
		'',
		// Homebrew's dependency-order cop wants platform constraints before formula dependencies.
		...(input.arch === undefined ? [] : [`  depends_on arch: :${input.arch}`]),
		...(input.os === undefined ? [] : [`  depends_on :${input.os}`]),
		'  depends_on "node"',
		'',
		'  def install',
		'    system "npm", "install", *std_npm_args',
		'    bin.install_symlink libexec.glob("bin/*")',
		'  end',
		'',
		'  test do',
		// eslint-disable-next-line unicorn/no-incorrect-template-string-interpolation -- Ruby interpolation is intentional.
		`    assert_match version.to_s, shell_output("#{bin}/${escapeRubyString(input.binName)} --version")`,
		'  end',
		'end',
		'',
	]

	return lines.join('\n')
}
