import axios from 'axios'

// Cloud Run API origin, injected at build time on Vercel (VITE_API_BASE, no trailing slash).
const apiBase = (import.meta.env.VITE_API_BASE || 'http://localhost:8080').replace(/\/+$/, '')
const api = axios.create({ baseURL: `${apiBase}/api` })

/** Message for an inline error. */
export function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback
}

export default api
