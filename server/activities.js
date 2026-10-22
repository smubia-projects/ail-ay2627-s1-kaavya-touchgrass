const express = require('express')
const { chatCompletion, AIError, aiConfigured } = require('./ai-client')
const interests = ['outdoors', 'fitness', 'creative', 'relaxing', 'social']
function validatePreferences(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'company,interests,location,minutes' ||
      !Array.isArray(value.interests) || value.interests.length < 1 || value.interests.length > 5 || new Set(value.interests).size !== value.interests.length || !value.interests.every(item => interests.includes(item)) ||
      ![10,20,30,60].includes(value.minutes) || !['solo','friends'].includes(value.company) || !['indoors','outdoors'].includes(value.location)) throw new AIError(400, 'Choose interests, 10/20/30/60 minutes, solo or friends, and indoors or outdoors.')
  return { interests: value.interests, minutes: value.minutes, company: value.company, location: value.location }
}
function validateActivities(value, prefs) {
  if (!value || !Array.isArray(value.activities) || value.activities.length !== 3) throw new Error('Expected three activities')
  const titles = new Set()
  return value.activities.map(item => {
    if (!item || !Number.isInteger(item.minutes) || item.minutes < 1 || item.minutes > prefs.minutes || item.location !== prefs.location || item.company !== prefs.company || !prefs.interests.includes(item.interest)) throw new Error('Activity does not match preferences')
    for (const [field, max] of [['title',80],['description',400],['firstStep',200]]) if (typeof item[field] !== 'string' || !item[field].trim() || item[field].length > max) throw new Error('Invalid activity text')
    const title = item.title.trim().toLowerCase()
    if (titles.has(title)) throw new Error('Duplicate activity')
    titles.add(title)
    return { title: item.title.trim(), minutes: item.minutes, description: item.description.trim(), firstStep: item.firstStep.trim(), interest: item.interest, location: item.location, company: item.company }
  })
}
async function suggestActivities(value, options) {
  const prefs = validatePreferences(value)
  const data = await chatCompletion({ maxTokens: 1200, messages: [
    { role: 'system', content: 'Suggest exactly 3 distinct general offline activities matching the selected preferences. Each must fit the time budget, location and company, and at least one selected interest. No screens, apps, websites, invented venues, events, opening hours, weather or claims of live local knowledge. Use ordinary accessible materials and no bookings. Return valid json only, matching this structured JSON schema: {"activities":[{"title":"...","minutes":10,"description":"...","firstStep":"...","interest":"one selected interest","location":"selected location","company":"selected company"}]}. Title at most 80 characters, description at most 400, firstStep at most 200. Durations must be positive whole minutes within the selected budget.' },
    { role: 'user', content: 'Return json for these selected preferences: ' + JSON.stringify(prefs) }
  ] }, options)
  try { return validateActivities(JSON.parse(data.choices[0].message.content), prefs) }
  catch { throw new AIError(502, 'AI returned invalid activity suggestions. Retry or use built-in suggestions.') }
}
function createActivityRouter({ suggest = suggestActivities, limit = (req, res, next) => next(), env = process.env } = {}) {
  const router = express.Router()
  // Validate and check configuration before the shared rate limiter, so bad input never uses quota.
  router.post('/', (req, res, next) => {
    try { req.preferences = validatePreferences(req.body) } catch (error) { return res.status(400).json({ message: error.message }) }
    if (suggest === suggestActivities && !aiConfigured(env)) return res.status(500).json({ message: 'AI is not configured on the backend. Use built-in suggestions.' })
    next()
  }, limit, async (req, res) => {
    try { res.json({ source: 'ai', activities: await suggest(req.preferences) }) }
    catch (error) { res.status(error.status || 502).json({ message: error.status ? error.message : 'Activity suggestions failed. Retry or use built-in suggestions.' }) }
  })
  return router
}
module.exports = { validatePreferences, validateActivities, suggestActivities, createActivityRouter }
