<script setup>
import { ImagePlus, Upload, CheckCircle2, RefreshCw, Sprout, ShieldCheck } from 'lucide-vue-next'
import { ref, onBeforeUnmount } from 'vue'
import api, { errorMessage } from '../api'

// Analyse only: the screenshot goes to the API for one AI extraction and nothing is saved.
const uploadInput = ref(null)
const selectedFile = ref(null)
const dragging = ref(false)
const fileError = ref('')
const imagePreview = ref('')
const busy = ref(false)
const error = ref('')
const result = ref(null)
function duration(minutes) { return `${Math.floor(minutes / 60)}h ${minutes % 60}m` }
function statusLabel(status) { return status === 'completed' ? 'Yesterday · would count as a completed day' : status === 'provisional' ? 'Today · would be provisional' : 'Not today or yesterday · would not count' }
function releasePreview() { if (imagePreview.value.startsWith('blob:')) URL.revokeObjectURL(imagePreview.value) }
onBeforeUnmount(releasePreview)
function selectFile(file) {
  if (busy.value || !file) return
  fileError.value = ''
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    fileError.value = 'Choose a PNG, JPEG, or WebP screenshot under 5 MB.'
    return
  }
  releasePreview()
  selectedFile.value = file
  imagePreview.value = URL.createObjectURL(file)
  result.value = null; error.value = ''
}
function chooseFile(event) { selectFile(event.target.files?.[0]); event.target.value = '' }
function dropFile(event) { dragging.value = false; selectFile(event.dataTransfer?.files?.[0]) }
function reset() {
  if (busy.value) return
  releasePreview()
  selectedFile.value = null; imagePreview.value = ''; result.value = null
  error.value = ''; fileError.value = ''
}
async function analyze() {
  if (busy.value || !selectedFile.value) return
  const file = selectedFile.value
  result.value = null; error.value = ''
  busy.value = true
  try {
    const image = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Could not read screenshot.'))
      reader.readAsDataURL(file)
    })
    const { data } = await api.post('/screenshots/analyze', { image }, { timeout: 70000 })
    result.value = data
    if (data.socialMediaMinutes === null) error.value = 'Upload a daily screenshot showing the Social or Social Networking category duration. Total phone usage cannot be used.'
  } catch (failure) {
    error.value = errorMessage(failure, 'Could not analyze the screenshot. Please retry or choose another screenshot.')
  } finally { busy.value = false }
}
</script>

<template>
  <div class="screenshot-checkin-layout">
    <section class="card checkin-flow" aria-labelledby="upload-title" :aria-busy="busy">
      <div class="card-body p-4">
        <h2 id="upload-title" class="feature-heading"><span class="feature-icon feature-peach"><ImagePlus class="icon-card" aria-hidden="true" /></span>Try your own screenshot</h2>
        <p>Upload a daily screen-time screenshot showing the date and Social / Social Networking usage. AI reads the minutes the way a real check-in would.</p>
        <p class="privacy-note"><ShieldCheck class="icon-control" aria-hidden="true" /> Your screenshot is sent to an AI provider for analysis and is not stored by TouchGrass. Nothing is saved.</p>
        <details class="data-disclosure screenshot-help"><summary>Screenshot requirements</summary><ul><li>Use a daily view with a readable date and Social / Social Networking category duration.</li><li>Total phone usage and app limits cannot be used.</li><li>PNG, JPEG or WebP, up to 5 MB.</li><li>Avoid screenshots with other personal information.</li></ul></details>
        <input ref="uploadInput" id="screenshot-file" class="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" :disabled="busy" aria-label="Choose screenshot" aria-describedby="screenshot-format" @change="chooseFile" />
        <div v-if="!selectedFile" class="screenshot-dropzone" :class="{ dragging }" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="dropFile">
          <span class="upload-icon"><Upload class="icon-empty" aria-hidden="true" /></span>
          <button type="button" class="btn btn-success" @click="uploadInput?.click()"><ImagePlus class="icon-control" aria-hidden="true" /> Choose screenshot</button>
          <p id="screenshot-format">Tap to upload <span class="desktop-drop-hint">or drag and drop</span><br />PNG, JPEG or WebP · Up to 5 MB</p>
        </div>
        <div v-else class="selected-screenshot">
          <img :src="imagePreview" alt="Selected social usage screenshot" />
          <div><strong>{{ selectedFile.name }}</strong><p id="screenshot-format" class="storage-note">{{ (selectedFile.size / 1024 / 1024).toFixed(1) }} MB · Ready to analyse</p></div>
        </div>
        <p v-if="fileError" role="alert" class="alert alert-danger mt-3">{{ fileError }}</p>
        <div v-if="selectedFile" class="screenshot-actions">
          <button type="button" class="btn btn-success" :disabled="busy" @click="analyze"><RefreshCw class="icon-control" aria-hidden="true" /> {{ busy ? 'Analysing…' : error || result ? 'Analyse again' : 'Analyse screenshot' }}</button>
          <button type="button" class="btn btn-outline-success" :disabled="busy" @click="uploadInput?.click()"><ImagePlus class="icon-control" aria-hidden="true" /> Change screenshot</button>
          <button type="button" class="btn btn-outline-secondary" :disabled="busy" @click="reset">Clear</button>
        </div>
        <p v-if="busy" class="analysis-status" role="status"><Sprout class="icon-control loading-sprout" aria-hidden="true" /> Reading the date and social usage. This may take a moment.</p>
        <p v-if="error" role="alert" class="alert alert-danger mt-3">{{ error }}</p>
        <section v-if="result && result.socialMediaMinutes !== null" class="checkin-result" aria-labelledby="review-title">
          <h3 id="review-title"><CheckCircle2 class="icon-card" aria-hidden="true" /> What the AI read</h3>
          <dl><div><dt>Date · Asia/Singapore</dt><dd>{{ result.date || 'Not readable' }}</dd></div><div><dt>Social usage</dt><dd>{{ duration(result.socialMediaMinutes) }}</dd></div></dl>
          <span class="checkin-badge" :class="result.submissionStatus === 'completed' ? 'badge-completed' : 'badge-provisional'">{{ statusLabel(result.submissionStatus) }}</span>
          <p class="storage-note">In the full app this would become your check-in for the group leaderboard. In this showcase nothing is saved.</p>
          <details v-if="result.notes" class="data-disclosure"><summary>Analysis notes</summary><p>{{ result.notes }}</p></details>
        </section>
      </div>
    </section>
    <aside class="card checkin-history" aria-labelledby="rules-title"><div class="card-body p-4">
      <h2 id="rules-title"><CheckCircle2 class="icon-card" aria-hidden="true" /> How check-ins work</h2>
      <ul>
        <li>Only daily Social / Social Networking usage counts, not total phone usage or app limits.</li>
        <li>Today's screenshot is provisional; yesterday's is a completed day (Asia/Singapore). Sunday can be submitted on Monday.</li>
        <li>Weeks run Monday–Sunday and lower weekly totals win. Missing days are never zero.</li>
        <li>Screenshots support the reported date and usage, but do not prove authenticity.</li>
      </ul>
    </div></aside>
  </div>
</template>
