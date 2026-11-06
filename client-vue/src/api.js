import axios from 'axios'
import { reactive } from 'vue'

// Cloud Run API origin, injected at build time on Vercel (VITE_API_BASE, no trailing slash).
const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const api = axios.create({ baseURL: `${apiBase}/api` })

// Shared state for the AI Lodge rate-limit CTA (429) and the "demo paused" notice (503).
export const limits = reactive({ cta: { open: false, count: null }, paused: '' })
export function dismissCta() { limits.cta.open = false }
export function dismissPaused() { limits.paused = '' }

api.interceptors.response.use(response => response, error => {
  const status = error.response?.status
  const body = error.response?.data || {}
  if (status === 429) {
    // The shared engine answers 429 { message, queries_used } (FastAPI variants nest it under detail).
    const used = body.queries_used ?? body.detail?.queries_used
    limits.cta.count = Number.isFinite(Number(used)) ? Number(used) : null
    limits.cta.open = true
    error.handledByRateLimit = true
  } else if (status === 503) {
    // 503 is reserved for the kill switch: show the paused notice, never the CTA.
    limits.paused = body.message || body.detail?.message || 'This demo is temporarily paused. Check back soon.'
    error.handledByRateLimit = true
  }
  return Promise.reject(error)
})

/** Message for an inline error, or '' when the CTA / paused notice already explains it. */
export function errorMessage(error, fallback) {
  if (error?.handledByRateLimit) return error.response?.status === 429 ? 'You have used this demo’s free AI requests.' : ''
  return error?.response?.data?.message || fallback
}

/** Non-AI substitutes are for provider errors only: over the AI limit (429) or with the demo paused (503) the feature stops. */
export function offersFallback(error) {
  return !error?.handledByRateLimit
}

export default api
