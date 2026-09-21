export type { NormalizeDescriptionResult } from './formula/description'
export { normalizeDescription } from './formula/description'
export { getFormulaClassName, getFormulaName, isValidFormulaName } from './formula/name'
export type { PlatformRequirements } from './formula/platform'
export { getPlatformRequirements } from './formula/platform'
export type { RenderFormulaInput } from './formula/render'
export { renderFormula } from './formula/render'
export type { UpdateFormulaResult } from './formula/update'
export { getVersionFromFormulaUrl, updateFormula } from './formula/update'
export { resolveGitHubToken } from './github/client'
export type { TapReference } from './github/tap'
export { parseTapName } from './github/tap'
export type { LocalPackageInfo } from './local-package'
export { getLocalPackageInfo } from './local-package'
export { setLogger } from './log'
export type {
	PublishFormulaDefaults,
	PublishFormulaOptions,
	PublishFormulaResult,
} from './publish-formula'
export {
	DEFAULT_PUBLISH_FORMULA_OPTIONS,
	formatPublishFormulaResult,
	publishFormula,
} from './publish-formula'
export type { GetPackageReleaseOptions, PackageRelease } from './registry'
export {
	DEFAULT_GET_PACKAGE_RELEASE_OPTIONS,
	DEFAULT_REGISTRY_URL,
	getPackageRelease,
} from './registry'
export { normalizeRepoUrl } from './utilities/repo-url'
