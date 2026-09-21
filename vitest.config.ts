/* eslint-disable ts/naming-convention */

import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		env: {
			BREWPUB_TEST_MOCK: process.env.BREWPUB_TEST_MOCK ?? 'true',
		},
		setupFiles: ['./test/setup.ts'],
		silent: 'passed-only',
	},
})
