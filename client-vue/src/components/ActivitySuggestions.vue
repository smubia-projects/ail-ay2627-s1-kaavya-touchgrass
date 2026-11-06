<script setup>
import { Trees, Dumbbell, Palette, Coffee, Users, Sprout, CheckCircle2, RefreshCw } from 'lucide-vue-next'
import EmptySprout from './EmptySprout.vue'
import { ref, computed, onBeforeUnmount } from 'vue'
import api, { errorMessage, offersFallback } from '../api'
import { interestOptions, storageKey, builtInActivities, validSaved } from '../activity-utils.mjs'
const interests = ref(['relaxing'])
const minutes = ref(20)
const company = ref('solo')
const location = ref('indoors')
const busy = ref(false)
const error = ref('')
const storageError = ref('')
const activities = ref([])
const source = ref('')
const completedCount = computed(() => activities.value.filter(a => a.completed).length)
const icons = { outdoors: Trees, fitness: Dumbbell, creative: Palette, relaxing: Coffee, social: Users }
const fallbackAvailable = ref(false)
let requestId = 0
onBeforeUnmount(() => { requestId++ })
function preferences() { return { interests: [...interests.value], minutes: minutes.value, company: company.value, location: location.value } }
function load() {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (!validSaved(saved)) throw new Error('Invalid saved suggestions')
    activities.value = saved.activities; source.value = saved.source
  } catch { storageError.value = 'Could not load browser-local activities. You can generate a new set.' }
}
load()
function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 1, source: source.value, activities: activities.value })); storageError.value = '' }
  catch { storageError.value = 'Browser storage is unavailable or full. Changes will only last while this view is open.' }
}
function toggle(index) { activities.value[index].completed = !activities.value[index].completed; persist() }
async function suggest() {
  if (busy.value || interests.value.length === 0) return
  const id = ++requestId
  busy.value = true; error.value = ''; fallbackAvailable.value = false
  try {
    const { data } = await api.post('/activities/suggest', preferences(), { timeout: 70000 })
    if (id !== requestId) return
    const saved = { version: 1, source: 'ai', activities: data.activities.map(item => ({ ...item, completed: false })) }
    if (!validSaved(saved)) throw new Error('Invalid suggestions')
    activities.value = saved.activities; source.value = 'ai'; persist()
  } catch (failure) {
    if (id !== requestId) return
    error.value = errorMessage(failure, 'Could not generate activities. Retry or choose built-in suggestions below.')
    fallbackAvailable.value = offersFallback(failure)
  } finally { if (id === requestId) busy.value = false }
}
function useBuiltIn() {
  if (busy.value || !interests.value.length) return
  activities.value = builtInActivities(preferences()); source.value = 'built-in'; persist()
  error.value = ''; fallbackAvailable.value = false
}
</script>

<template>
  <section class="card border-0 shadow-sm mb-3 activities-panel">
    <div class="card-body p-4">
      <h3 class="h5 feature-heading"><span class="feature-icon feature-mustard"><Sprout class="icon-card" aria-hidden="true" /></span>Touch Grass activities</h3>
      <p>Make a little room for life beyond the screen.</p><p class="storage-note">Saved in this browser</p>
      <details class="data-disclosure"><summary>How it works · About your data</summary><p>Suggestions and completion stay in this browser, without syncing across devices. Clearing browser data removes them. Only your selected preferences are sent to the AI provider. Completion is self-reported, not verified offline time. A new set replaces the current saved set.</p></details>
      <p v-if="!activities.length && !busy" class="empty-help"><EmptySprout />No activities yet. Choose your interests, time, company and setting, then click Suggest activities below.</p>
      <form @submit.prevent="suggest">
        <fieldset :disabled="busy">
          <legend class="h6">Interests (choose at least one)</legend>
          <div class="interest-chips"><button v-for="interest in interestOptions" :key="interest" type="button" :aria-pressed="interests.includes(interest)" :class="{ active: interests.includes(interest) }" @click="interests = interests.includes(interest) ? interests.filter(i => i !== interest) : [...interests, interest]"><component :is="icons[interest]" class="icon-control" aria-hidden="true" /> {{ interest }}</button></div>
          <div class="activity-preferences">
            <fieldset><legend>Available time</legend><div class="time-pills"><button v-for="time in [10,20,30,60]" :key="time" type="button" :aria-pressed="minutes === time" :class="{ active: minutes === time }" @click="minutes = time">{{ time }} min</button></div></fieldset>
            <fieldset><legend>Company</legend><div class="segmented-control"><button v-for="option in ['solo','friends']" :key="option" type="button" :class="{ active: company === option }" :aria-pressed="company === option" @click="company = option">{{ option === 'solo' ? 'Solo' : 'With friends' }}</button></div></fieldset>
            <fieldset><legend>Setting</legend><div class="segmented-control"><button v-for="option in ['indoors','outdoors']" :key="option" type="button" :class="{ active: location === option }" :aria-pressed="location === option" @click="location = option">{{ option === 'indoors' ? 'Indoors' : 'Outdoors' }}</button></div></fieldset>
          </div>
          <button class="btn btn-success" :disabled="busy || !interests.length">{{ busy ? 'Suggesting...' : error ? 'Retry suggestions' : 'Suggest activities' }}</button>
        </fieldset>
      </form>
      <p v-if="busy" role="status" class="activity-loading mt-3"><Sprout class="icon-control loading-sprout" aria-hidden="true" /> Gathering three ideas for a screen-free pause…</p>
      <div v-if="error" role="alert" class="alert alert-warning mt-3">{{ error }}</div>
      <button v-if="fallbackAvailable" class="btn btn-outline-success mt-2" :disabled="busy || !interests.length" @click="useBuiltIn">Use built-in suggestions (not AI-generated)</button>
      <p v-if="storageError" role="alert" class="text-danger mt-2">{{ storageError }}</p>
      <p v-if="activities.length" class="small text-secondary mt-3">{{ source === 'built-in' ? 'Built-in suggestions — not AI-generated' : 'AI-generated suggestions' }}. General ideas; no live venue or event information. Generating a new set replaces this saved set.</p>
      <p v-if="activities.length" role="status" class="completion-count"><strong>{{ completedCount }} of 3 completed</strong> · Self-reported progress</p>
      <div class="row g-3 mt-1">
        <div v-for="(activity, index) in activities" :key="index" class="col-md-4">
          <article class="card h-100 activity-card" :class="[`activity-tone-${index}`, { completed: activity.completed }]"><div class="card-body"><span class="activity-card-icons"><span class="feature-icon feature-sage"><component :is="icons[activity.interest] || Sprout" class="icon-card" aria-hidden="true" /></span><CheckCircle2 v-if="activity.completed" class="icon-card completion-flourish" aria-hidden="true" /></span>
            <h4 class="h6">{{ activity.title }}</h4><p class="small">{{ activity.minutes }} minutes</p>
            <p>{{ activity.description }}</p><p><strong>First step:</strong> {{ activity.firstStep }}</p>
            <p v-if="activity.completed" role="status" class="text-success completion-flourish">Completed (self-reported)</p>
            <button class="btn btn-outline-success btn-sm" :aria-pressed="activity.completed" @click="toggle(index)"><component :is="activity.completed ? RefreshCw : CheckCircle2" class="icon-control" aria-hidden="true" /> {{ activity.completed ? 'Undo completion' : 'Mark completed' }}</button>
          </div></article>
        </div>
      </div>
    </div>
  </section>
</template>
