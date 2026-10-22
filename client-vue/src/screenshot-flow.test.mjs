import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { ref } from 'vue'

// Exercise the component's actual event handlers without a browser or an AI request.
const source = await readFile(new URL('./components/ScreenshotCheckIn.vue', import.meta.url), 'utf8')
const script = source.split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
const errorMessage = (error, fallback) => error?.response?.data?.message || fallback
function flow(api) {
  const create = new Function('ref', 'onBeforeUnmount', 'api', 'errorMessage', `${script}\nreturn { selectFile, chooseFile, analyze, reset, selectedFile, result, error, fileError, busy, imagePreview }`)
  return create(ref, () => {}, api, errorMessage)
}
function image(name = 'daily.png') { return new File(['image'], name, { type: 'image/png' }) }

test('selection is local, invalid changes retain selection, and reset clears the flow', () => {
  let calls = 0
  const ui = flow({ post() { calls++ } })
  const selected = image()
  ui.selectFile(selected)
  assert.equal(calls, 0)
  assert.equal(ui.selectedFile.value, selected)
  assert.ok(ui.imagePreview.value.startsWith('blob:'))
  ui.selectFile(new File(['text'], 'wrong.txt', { type: 'text/plain' }))
  assert.ok(ui.fileError.value.includes('PNG'))
  assert.equal(ui.selectedFile.value, selected)
  ui.selectFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }))
  assert.ok(ui.fileError.value)
  ui.reset()
  assert.equal(ui.selectedFile.value, null)
  assert.equal(ui.imagePreview.value, '')
})

test('analysis is explicit, guarded while busy, analyse-only, and never saves', async () => {
  const originalReader = globalThis.FileReader
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,aW1hZ2U='; this.onload() } }
  const calls = []
  let resolveAnalysis
  const ui = flow({ post(path, body) { calls.push({ path, body }); return new Promise(resolve => { resolveAnalysis = resolve }) } })
  try {
    ui.selectFile(image())
    const pending = ui.analyze()
    await Promise.resolve()
    await ui.analyze()
    ui.selectFile(image('other.png'))
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0], { path: '/screenshots/analyze', body: { image: 'data:image/png;base64,aW1hZ2U=' } })
    assert.equal(ui.selectedFile.value.name, 'daily.png')
    resolveAnalysis({ data: { date: '2026-10-17', socialMediaMinutes: 45, submissionStatus: 'completed', notes: '' } })
    await pending
    assert.equal(ui.result.value.socialMediaMinutes, 45)
    assert.equal(ui.error.value, '')
    assert.equal(calls.length, 1)
    assert.ok(!/check-ins|analysisToken|localStorage/.test(script))
    ui.reset()
  } finally { globalThis.FileReader = originalReader }
})

test('missing category and server errors surface as messages and allow retry', async () => {
  const originalReader = globalThis.FileReader
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:image/png;base64,aW1hZ2U='; this.onload() } }
  let attempts = 0
  const ui = flow({ post: async () => { if (++attempts === 1) throw { response: { data: { message: 'Please retry' } } }; return { data: { date: null, socialMediaMinutes: null, notes: 'No social category' } } } })
  try {
    ui.selectFile(image())
    await ui.analyze()
    assert.equal(ui.error.value, 'Please retry')
    assert.equal(ui.busy.value, false)
    await ui.analyze()
    assert.match(ui.error.value, /Social or Social Networking/)
  } finally { globalThis.FileReader = originalReader }
})
