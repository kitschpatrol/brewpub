import { describe, expect, it } from 'vitest'
import { normalizeRepoUrl } from '../src/lib'

describe('normalizeRepoUrl', () => {
	it.each([
		['https://github.com/example/foo', 'https://github.com/example/foo'],
		['https://github.com/example/foo.git', 'https://github.com/example/foo'],
		['git+https://github.com/example/foo.git', 'https://github.com/example/foo'],
		['git+ssh://git@github.com/example/foo.git', 'https://github.com/example/foo'],
		['ssh://git@github.com/example/foo.git', 'https://github.com/example/foo'],
		['git@github.com:example/foo.git', 'https://github.com/example/foo'],
		['git://github.com/example/foo.git', 'https://github.com/example/foo'],
		['github:example/foo', 'https://github.com/example/foo'],
		['gitlab:example/foo', 'https://gitlab.com/example/foo'],
		['https://github.com/example/foo/', 'https://github.com/example/foo'],
		['https://github.com/example/foo?tab=readme#top', 'https://github.com/example/foo'],
		['  https://github.com/example/foo  ', 'https://github.com/example/foo'],
		['not a url', undefined],
		['ftp://example.com/foo', undefined],
		['https://github.com', undefined],
	])('%j → %j', (input, expected) => {
		expect(normalizeRepoUrl(input)).toBe(expected)
	})
})
