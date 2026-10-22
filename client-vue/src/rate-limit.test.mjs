import test, { after } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

// api.js reads import.meta.env, so load it through Vite. Requests use a stub adapter: no network.
const server = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)), configFile: false, server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom' })
after(() => server.close())
const { default: api, limits, errorMessage, offersFallback } = await server.ssrLoadModule('/src/api.js')

async function respond(status, data) {
  const adapter = async config => { const error = new Error('HTTP ' + status); error.config = config; error.response = { status, data, config }; throw error }
  try { await api.post('/activities/suggest', {}, { adapter }) } catch (error) { return error }
}

test('429 opens the CTA with queries_used from the engine body and never the paused notice', async () => {
  const error = await respond(429, { message: 'Rate limit exceeded.', queries_used: 5 })
  assert.equal(limits.cta.open, true)
  assert.equal(limits.cta.count, 5)
  assert.equal(limits.paused, '')
  assert.match(errorMessage(error, 'x'), /free AI requests/)
  assert.equal(offersFallback(error), false)  // over the limit the feature stops: no built-in substitute
  limits.cta.open = false
})

test('503 shows the paused notice with the body message and never the CTA', async () => {
  const error = await respond(503, { message: 'This demo is temporarily paused. Check back soon.' })
  assert.equal(limits.cta.open, false)
  assert.equal(limits.paused, 'This demo is temporarily paused. Check back soon.')
  assert.equal(errorMessage(error, 'x'), '')
  assert.equal(offersFallback(error), false)
  limits.paused = ''
})

test('other errors keep their own message', async () => {
  const error = await respond(500, { message: 'AI is not configured on the backend.' })
  assert.equal(limits.cta.open, false)
  assert.equal(limits.paused, '')
  assert.equal(errorMessage(error, 'x'), 'AI is not configured on the backend.')
  assert.equal(offersFallback(error), true)  // provider/config errors may still offer built-in suggestions
})
