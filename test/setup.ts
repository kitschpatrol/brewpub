import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mocks/server'

beforeAll(() => {
	server.listen({
		onUnhandledRequest: process.env.BREWPUB_TEST_MOCK === 'false' ? 'bypass' : 'error',
	})
})

afterEach(() => {
	server.resetHandlers()
})

afterAll(() => {
	server.close()
})
