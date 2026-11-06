const test = require('node:test')
const assert = require('node:assert/strict')
const request = require('supertest')
const { createApp } = require('./app')
// Never let a developer's real key turn a test into a paid provider call.
for (const name of ['OPENROUTER_API_KEY', 'AI_API_KEY']) delete process.env[name]
const origin = 'https://ail-ay2627-s1-kaavya-touchgrass.vercel.app'
const env = { CORS_ORIGINS: `${origin}/, http://localhost:5173` }

test('health check is public and stateless', async () => {
  const response = await request(createApp({ env })).get('/api/health')
  assert.equal(response.status, 200)
  assert.deepEqual(response.body, { status: 'ok' })
  assert.equal(response.headers['set-cookie'], undefined)
})

test('CORS allows only configured origins and never sends credentials', async () => {
  const app = createApp({ env })
  const allowed = await request(app).get('/api/health').set('Origin', origin)
  assert.equal(allowed.headers['access-control-allow-origin'], origin)
  assert.equal(allowed.headers['access-control-allow-credentials'], undefined)
  const blocked = await request(app).get('/api/health').set('Origin', 'https://untrusted.example')
  assert.equal(blocked.headers['access-control-allow-origin'], undefined)
})

test('accounts, groups and check-ins no longer exist; unknown routes are JSON 404s', async () => {
  const app = createApp({ env })
  for (const [method, path] of [['get', '/api/auth/me'], ['get', '/api/groups'], ['post', '/api/groups/DEMO/check-ins'], ['get', '/']]) {
    assert.equal((await request(app)[method](path)).status, 404, `${method} ${path}`)
  }
})

test('screenshot JSON envelope fits the 7 MiB parser, while oversized ordinary requests fail', async () => {
  const app = createApp({ env: { ...env, OPENROUTER_API_KEY: '', AI_API_KEY: '' } })
  const image = 'data:image/png;base64,' + Buffer.alloc(5 * 1024 * 1024).toString('base64')
  assert.ok(Buffer.byteLength(JSON.stringify({ image })) < 7 * 1024 * 1024)
  // Parser accepts the size; the request then stops at input/config validation, before any provider call.
  assert.notEqual((await request(app).post('/api/screenshots/analyze').send({ image })).status, 413)
  assert.equal((await request(app).post('/api/activities/suggest').send({ excess: 'x'.repeat(17000) })).status, 413)
  assert.equal((await request(app).post('/api/screenshots/analyze').send({ image: 'x'.repeat(7 * 1024 * 1024) })).status, 413)
})
