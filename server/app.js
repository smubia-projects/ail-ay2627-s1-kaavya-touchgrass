const express = require('express')
const cors = require('cors')

// Public, stateless API: no accounts, sessions or database. Screenshots are analysed
// in memory and never logged or persisted; only the extracted values are returned.
function corsOrigins(env) {
  return String(env.CORS_ORIGINS || 'http://localhost:5173').split(',').map(origin => origin.trim().replace(/\/+$/, '')).filter(Boolean)
}

function createApp({ env = process.env } = {}) {
  const origins = corsOrigins(env)
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin(origin, callback) { callback(null, !origin || origins.includes(origin)) }, allowedHeaders: ['Content-Type'], methods: ['GET', 'POST', 'OPTIONS'] }))
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    res.set('X-Content-Type-Options', 'nosniff')
    next()
  })
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  // The screenshot router parses its own 7 MB body; every other JSON route stays small.
  app.use((req, res, next) => req.path === '/api/screenshots/analyze' ? next() : express.json({ limit: '16kb' })(req, res, next))
  app.use('/api/screenshots/analyze', require('./screenshot').router)
  app.use('/api/activities/suggest', require('./activities').createActivityRouter())
  app.use((req, res) => res.status(404).json({ message: 'Endpoint not found.' }))
  app.use((error, req, res, next) => {
    if (res.headersSent) { res.end(); return }
    res.status(error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500).json({ message: error.type === 'entity.too.large' ? 'Request is too large.' : error.type === 'entity.parse.failed' ? 'Invalid JSON request.' : 'Request failed. Please retry.' })
  })
  return app
}
module.exports = { createApp, corsOrigins }
