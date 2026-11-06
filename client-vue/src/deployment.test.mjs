import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Vercel builds the static Vite app with npm and has no API proxy', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.framework, 'vite')
  assert.equal(config.installCommand, 'npm ci')
  assert.equal(config.outputDirectory, 'dist')
  // The browser calls Cloud Run directly via VITE_API_BASE, so the rate limiter sees the real client IP.
  assert.ok(!JSON.stringify(config.rewrites).includes('/api'))
})

test('API base comes from VITE_API_BASE, without credentials or CSRF headers', async () => {
  const source = await readFile(new URL('./api.js', import.meta.url), 'utf8')
  assert.match(source, /import\.meta\.env\.VITE_API_BASE/)
  assert.ok(!/withCredentials|X-CSRF-Token|onrender\.com/.test(source))
})
