const VALID_FORMULA_NAME = /^[a-z0-9._+@\-]+$/v
const SEPARATOR_THEN_CHARACTER = /[\-_.\s][a-zA-Z0-9]/gv
const VERSION_SUFFIX = /(?<before>.)@(?<digit>\d)/v

/**
 * Whether a string is a valid Homebrew formula name (lowercase letters, digits,
 * `.`, `_`, `+`, and `-`).
 */
export function isValidFormulaName(name: string): boolean {
	return VALID_FORMULA_NAME.test(name)
}

/**
 * Derive the Homebrew formula name for an npm package. Scopes are dropped, so
 * `@scope/name` becomes `name`.
 *
 * @throws {Error} When the resulting name isn't a valid formula name.
 */
export function getFormulaName(packageName: string): string {
	const unscoped = packageName.startsWith('@')
		? packageName.slice(packageName.indexOf('/') + 1)
		: packageName
	const name = unscoped.toLowerCase()

	if (!isValidFormulaName(name)) {
		throw new Error(
			`Cannot derive a Homebrew formula name from package name "${packageName}". Pass one explicitly with the "name" option.`,
		)
	}

	return name
}

/**
 * Convert a formula name to its Ruby class name, matching Homebrew's
 * `Formulary.class_s`: `foo-bar` → `FooBar`, `c++` → `Cxx`, `node@20` →
 * `NodeAT20`.
 */
export function getFormulaClassName(formulaName: string): string {
	const capitalized = formulaName.charAt(0).toUpperCase() + formulaName.slice(1).toLowerCase()

	return capitalized
		.replaceAll(SEPARATOR_THEN_CHARACTER, (match) => match.slice(-1).toUpperCase())
		.replaceAll('+', 'x')
		.replace(VERSION_SUFFIX, '$<before>AT$<digit>')
}
