import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSSRApp } from 'vue'
import { renderToString } from '@vue/server-renderer'

test('demo renders fictional completed results with a persistent sample label and no controls', async () => {
  const server = await createServer({
    root: fileURLToPath(new URL('..', import.meta.url)), configFile: false,
    plugins: [vue()], server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom'
  })
  try {
    const { default: Demo } = await server.ssrLoadModule('/src/components/ExploreDemo.vue')
    const html = await renderToString(createSSRApp(Demo))
    assert.ok(html.includes('Demo · sample data'))
    assert.ok(html.includes('The Sunday Sprouts'))
    assert.ok(html.includes('Bring homemade lemonade'))
    assert.equal((html.match(/<article[^>]+class="[^"]*\bpodium-block\b/g) || []).length, 3)
    assert.equal((html.match(/<time datetime=/g) || []).length, 28)
    assert.equal((html.match(/<button/g) || []).length, 0)
    assert.ok(!/<form|<input|<textarea/.test(html))
    assert.ok(html.includes('2026-09-07') && html.includes('2026-09-13'))
  } finally { await server.close() }
})

test('demo dependency boundary excludes APIs and persistence; the app has no login gate', async () => {
  const source = await readFile(new URL('./components/ExploreDemo.vue', import.meta.url), 'utf8')
  const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1])
  assert.deepEqual(imports, ['lucide-vue-next', './SummaryCard.vue', '../demo/leaderboard.json'])
  assert.ok(!/localStorage|sessionStorage|fetch\(|axios|api\.|analysisToken|@submit/.test(source))
  const app = await readFile(new URL('./App.vue', import.meta.url), 'utf8')
  assert.ok(app.includes("<ExploreDemo v-show=\"view === 'leaderboard'\""))
  for (const removed of ['AuthWelcome', 'GroupDashboard', 'InviteCode', '/auth/', 'csrf']) assert.ok(!app.includes(removed), removed)
})
