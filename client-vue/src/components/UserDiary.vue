<script setup>
import { CalendarDays, Clock, PenLine, ChevronLeft, ChevronRight, BookOpen } from 'lucide-vue-next'
import EmptySprout from './EmptySprout.vue'
import { ref, computed, watch } from 'vue'
import { dateKey, weekDates, duration, usageHours } from '../diary-utils.mjs'
const today = dateKey(new Date())
const date = ref(today), week = ref(today), hours = ref(''), minutes = ref(''), note = ref('')
const loadFailed = ref(false)
const entries = ref([]), errorMessage = ref(''), successMessage = ref('')
// Browser-local only (no accounts); prefixed with the project slug.
const storageKey = 'ail-ay2627-s1-kaavya-touchgrass:diary'
const days = computed(() => weekDates(week.value))
const entryFor = key => entries.value.find(entry => entry.date === key)
const existing = computed(() => entryFor(date.value))
const logged = computed(() => entries.value.filter(entry => days.value.includes(entry.date)))
const average = computed(() => logged.value.length ? duration(logged.value.reduce((sum, entry) => sum + entry.hours, 0) / logged.value.length) : 'No entries yet')
const label = key => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
function loadDay() {
  const entry = entryFor(date.value)
  const total = entry ? Math.round(entry.hours * 60) : null
  hours.value = total === null ? '' : Math.floor(total / 60)
  minutes.value = total === null ? '' : total % 60
  note.value = entry?.note || ''
  successMessage.value = ''
}
function load() {
  entries.value = []; errorMessage.value = ''; loadFailed.value = false
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
    if (!Array.isArray(saved) || !saved.every(e => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && typeof e.hours === 'number' && Number.isFinite(e.hours) && e.hours >= 0 && e.hours <= 24 && typeof e.note === 'string')) throw Error()
    entries.value = saved
  } catch { loadFailed.value = true; errorMessage.value = 'Could not load your saved diary. Existing browser data has not been changed.' }
  date.value = today; week.value = today; loadDay()
}
load()
watch(date, () => { week.value = date.value; loadDay() })
function moveWeek(offset) {
  const next = new Date(`${days.value[0]}T12:00:00`)
  next.setDate(next.getDate() + offset * 7); week.value = dateKey(next)
}
function addPrompt(prompt) { note.value += `${note.value ? '\n\n' : ''}${prompt} ` }
function saveEntry() {
  if (loadFailed.value) return
  successMessage.value = ''
  const value = usageHours(hours.value, minutes.value)
  if (value === null) { errorMessage.value = 'Enter whole hours and minutes from 0h 0m to 24h 0m.'; return }
  if (date.value > dateKey(new Date())) { errorMessage.value = 'Choose today or an earlier day.'; return }
  const updating = !!existing.value
  // Retain the original decimal-hour schema and all other dates exactly as saved.
  const updated = entries.value.filter(entry => entry.date !== date.value)
  updated.push({ date: date.value, hours: value, note: note.value.trim() })
  try {
    localStorage.setItem(storageKey, JSON.stringify(updated))
    entries.value = updated; errorMessage.value = ''
    successMessage.value = updating ? 'Entry updated.' : 'Entry saved.'
  } catch { errorMessage.value = 'Could not save. Browser storage may be unavailable.' }
}
</script>

<template>
  <section class="card diary-panel">
    <div class="card-body p-4">
      <h2 class="feature-heading"><span class="feature-icon feature-sage"><BookOpen class="icon-card" aria-hidden="true" /></span>My usage diary</h2>
      <p>A little reflection on your total phone usage.</p>
      <p class="storage-note">Saved in this browser only</p>
      <details class="data-disclosure"><summary>About your data</summary><p>Entries stay in this browser; they are never sent to the server and do not sync across devices. Clearing browser data removes them. These manual logs are personal reflections and never count towards group rankings.</p></details>
      <div class="diary-layout">
        <section class="weekly-overview" aria-labelledby="weekly-title">
          <div class="week-heading"><h3 id="weekly-title"><CalendarDays class="icon-control" aria-hidden="true" /> Your week</h3><div class="week-arrows"><button type="button" aria-label="Previous week" @click="moveWeek(-1)"><ChevronLeft class="icon-control" aria-hidden="true" /></button><button type="button" aria-label="Next week" @click="moveWeek(1)"><ChevronRight class="icon-control" aria-hidden="true" /></button></div></div>
          <p class="week-range">{{ label(days[0]) }} – {{ label(days[6]) }}</p>
          <div class="date-strip" aria-label="Choose a diary day">
            <button v-for="(day, index) in days" :key="day" type="button" :class="{ selected: date === day, today: day === today }" :aria-pressed="date === day" :aria-current="day === today ? 'date' : undefined" :aria-label="`${label(day)}${day === today ? ', today' : ''}, ${entryFor(day) ? 'saved entry' : 'no entry'}`" @click="date = day">
              <span>{{ ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index] }}</span><strong>{{ Number(day.slice(-2)) }}</strong><span class="entry-dot" :class="{ saved: entryFor(day) }" aria-hidden="true"></span>
            </button>
          </div>
          <p class="chart-caption">Manually logged total phone usage <span class="storage-note">(0–24h scale)</span></p>
          <div class="usage-chart" aria-label="Weekly phone usage; missing days are not tracked">
            <button v-for="(day, index) in days" :key="day" type="button" class="usage-column" :class="{ chosen: day === date }" :aria-pressed="date === day" :aria-label="`${label(day)}: ${entryFor(day) ? duration(entryFor(day).hours) : 'Missing entry'}`" @click="date = day">
              <span class="bar-track"><span v-if="entryFor(day)" class="usage-bar" :style="{ height: `${Math.max(2, entryFor(day).hours / 24 * 100)}%` }"></span><span v-else class="missing-mark" aria-hidden="true">–</span></span>
              <span>{{ ['M','T','W','T','F','S','S'][index] }}</span><span class="bar-value">{{ entryFor(day) ? duration(entryFor(day).hours) : 'Missing' }}</span>
            </button>
          </div>
          <EmptySprout v-if="!logged.length" /><div class="week-stat"><strong>{{ average }}</strong><span>Average over {{ logged.length }} logged {{ logged.length === 1 ? 'day' : 'days' }} · {{ logged.length }} of 7 entries</span></div>
          <p class="storage-note">Unlogged days are missing and excluded from the average.</p>
        </section>
        <form class="diary-form" @submit.prevent="saveEntry">
          <h3>{{ existing ? 'Edit your entry' : 'A moment for yourself' }}</h3>
          <p>{{ label(date) }}{{ date === today ? ' · Today' : '' }}</p>
          <fieldset><legend><Clock class="icon-control" aria-hidden="true" /> Total phone usage</legend><div class="duration-inputs"><div><label for="diary-hours">Hours</label><input id="diary-hours" v-model="hours" type="number" min="0" max="24" step="1" class="form-control" required /></div><div><label for="diary-minutes">Minutes</label><input id="diary-minutes" v-model="minutes" type="number" min="0" max="59" step="1" class="form-control" required /></div></div><p class="storage-note">From your phone’s screen-time report. Maximum 24h 0m.</p></fieldset>
          <label for="diary-note" class="form-label"><PenLine class="icon-control" aria-hidden="true" /> Reflection (optional)</label>
          <textarea id="diary-note" v-model="note" class="form-control" rows="4" placeholder="What did you notice today?"></textarea>
          <div class="prompt-chips" aria-label="Add a reflection prompt"><button v-for="prompt in ['What made me scroll?', 'What helped me disconnect?']" :key="prompt" type="button" @click="addPrompt(prompt)">+ {{ prompt }}</button></div>
          <p class="storage-note">Tap a prompt to append it to your reflection.</p>
          <p v-if="errorMessage" role="alert" class="alert alert-danger">{{ errorMessage }}</p><p v-if="successMessage" role="status" class="alert alert-success">{{ successMessage }}</p>
          <button class="btn btn-success w-100" :disabled="date > today || loadFailed">{{ existing ? 'Update entry' : 'Save entry' }}</button>
          <p v-if="date > today" class="storage-note mt-2">Come back on this day to log your usage.</p>
        </form>
      </div>
    </div>
  </section>
</template>
