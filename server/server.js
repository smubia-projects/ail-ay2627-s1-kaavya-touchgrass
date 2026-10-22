require('dotenv').config({ path: require('path').join(__dirname, '.env'), quiet: true })
const { createApp } = require('./app')

function startServer() {
  const port = Number(process.env.PORT) || 8080
  const server = createApp().listen(port, '0.0.0.0', () => console.log(`TouchGrass API listening on 0.0.0.0:${port}`))
  server.on('error', error => { console.error('HTTP server failed:', error.code); process.exit(1) })
  return server
}
if (require.main === module) startServer()
module.exports = { startServer }
