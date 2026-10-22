const { test } = require('node:test')
const assert = require('node:assert/strict')
const { analyzeScreenshot } = require('./screenshot')

const image = 'data:image/png;base64,aGVsbG8='
const env = { OPENROUTER_MODEL: 'openai/gpt-4o-mini', OPENROUTER_API_KEY: 'test-secret' }
test('sends image data URL in Chat Completions format and parses usage', async () => {
  const result = await analyzeScreenshot(image, { env, fetchImpl: async (url, request) => {
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions')
    const body = JSON.parse(request.body)
    assert.equal(body.model, env.OPENROUTER_MODEL)
    assert.equal(body.messages[0].content[1].image_url.url, image)
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ date: null, totalMinutes: 120, socialMediaMinutes: null, notes: 'Date missing' }) } }] }) }
  } })
  assert.equal(result.socialMediaMinutes, null)
})
test('rejects invalid uploads and missing configuration', async () => {
  await assert.rejects(analyzeScreenshot('https://example.test/image'), { status: 400 })
  await assert.rejects(analyzeScreenshot(image, { env: {} }), { status: 500 })
})
test('reports provider HTTP status without disclosing provider body or key', async () => {
  await assert.rejects(analyzeScreenshot(image, { env, fetchImpl: async () => ({ ok: false, status: 401 }) }), error => error.providerStatus === 401 && !error.message.includes(env.OPENROUTER_API_KEY))
})
test('rejects malformed provider analysis', async () => {
  await assert.rejects(analyzeScreenshot(image, { env, fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{}' } }] }) }) }), { status: 502 })
})

test('each upload sends its own image and returns its own provider values', async () => {
  const images = ['data:image/png;base64,YQ==', 'data:image/png;base64,Yg==']
  const values = [47, 213]
  for (let i = 0; i < images.length; i++) {
    const result = await analyzeScreenshot(images[i], { env, fetchImpl: async (url, request) => {
      const body = JSON.parse(request.body)
      assert.equal(body.messages.length, 1)
      assert.equal(body.messages[0].content[1].image_url.url, images[i])
      return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ date: null, totalMinutes: 999, socialMediaMinutes: values[i], notes: 'Year not visible' }) } }] }) }
    } })
    assert.equal(result.socialMediaMinutes, values[i])
  }
})
