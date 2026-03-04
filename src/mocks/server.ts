import { setupServer } from 'msw/node'
import { handlers } from './handlers'

// Node-based MSW server for use in Vitest (jsdom environment)
// browser.ts uses setupWorker for browser; this file uses setupServer for tests
export const server = setupServer(...handlers)
