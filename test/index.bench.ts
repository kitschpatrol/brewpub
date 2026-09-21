import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

const baselinePath = path.resolve(import.meta.dirname, 'benchmarks/baseline.json')

it('array sorting', { timeout: 30_000 }, async ({ bench }) => {
	const writeBaseline = process.env.npm_lifecycle_event === 'bench:baseline'
	let result: number[] = []
	const current = bench(
		'current',
		{ writeResult: writeBaseline ? baselinePath : undefined },
		() => {
			// Replace this example with the operation you want to measure.
			result = [3, 1, 2].toSorted((a, b) => a - b)
		},
	)

	if (!writeBaseline && existsSync(baselinePath)) {
		// Vitest 5 comparisons are not test declarations.
		// eslint-disable-next-line test/expect-expect, test/valid-title
		await bench.compare(current, bench.from('baseline', baselinePath))
	} else {
		await current.run()
	}

	// Consume the result outside the timed callback.
	expect(result).toEqual([1, 2, 3])
})
