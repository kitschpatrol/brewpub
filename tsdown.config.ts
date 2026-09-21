import { defineConfig } from 'tsdown'

export default defineConfig({
	attw: {
		profile: 'esm-only',
	},
	entry: {
		'bin/cli': 'src/bin/cli.ts',
		'lib/index': 'src/lib/index.ts',
	},
	fixedExtension: false,
	minify: false,
	outDir: 'dist',
	platform: 'node',
	publint: true,
	tsconfig: 'tsconfig.build.json',
})
