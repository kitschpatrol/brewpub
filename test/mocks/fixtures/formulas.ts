/* eslint-disable unicorn/no-incorrect-template-string-interpolation -- Ruby interpolation syntax. */

import { fooBar } from './registry'

/** What brewpub should render for the `fooBar` registry fixture. */
export const fooBarFormula = `class FooBar < Formula
  desc "Command-line tool for doing things"
  homepage "https://github.com/example/foo-bar"
  url "https://registry.npmjs.org/foo-bar/-/foo-bar-1.2.3.tgz"
  sha256 "${fooBar.sha256}"
  license "MIT"

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    assert_match version.to_s, shell_output("#{bin}/foo-bar --version")
  end
end
`

/**
 * A previously published formula that has been through `brew pr-pull`, so it
 * carries a bottle block, plus a livecheck block and a customized test. Only
 * the top-level url and sha256 should ever change.
 */
export const fooBarFormulaWithBottle = `class FooBar < Formula
  desc "Command-line tool for doing things"
  homepage "https://github.com/example/foo-bar"
  url "https://registry.npmjs.org/foo-bar/-/foo-bar-1.2.2.tgz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  license "MIT"

  livecheck do
    url "https://registry.npmjs.org/foo-bar/latest"
    strategy :json
  end

  bottle do
    sha256 cellar: :any_skip_relocation, arm64_sequoia: "1111111111111111111111111111111111111111111111111111111111111111"
    sha256 cellar: :any_skip_relocation, arm64_sonoma:  "2222222222222222222222222222222222222222222222222222222222222222"
  end

  depends_on "node"

  def install
    system "npm", "install", *std_npm_args
    bin.install_symlink libexec.glob("bin/*")
  end

  test do
    # Custom test that must survive updates
    assert_match "usage", shell_output("#{bin}/foo-bar --help")
  end
end
`

/** The bottle formula, but already at 1.2.3 with the fixture's sha256. */
export const fooBarFormulaWithBottleCurrent = fooBarFormulaWithBottle
	.replace('foo-bar-1.2.2.tgz', 'foo-bar-1.2.3.tgz')
	.replace('0000000000000000000000000000000000000000000000000000000000000000', () => fooBar.sha256)

/** A formula already ahead of the fixture version. */
export const fooBarFormulaNewer = fooBarFormulaWithBottle.replace(
	'foo-bar-1.2.2.tgz',
	'foo-bar-9.0.0.tgz',
)
