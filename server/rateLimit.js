/**
 * Rate-limit adapter: the shared AI Lodge engine (rateLimitEngine.mjs, copied verbatim)
 * with this project's slug and one bucket per LLM action. The engine handles
 * X-Forwarded-For, central config from the control sheet, event mode, the kill switch
 * (503) and fail-open. Without Upstash credentials it is a no-op (local development).
 *
 * The engine is ESM; this CommonJS server loads it with require(esm), supported
 * without flags on Node 24 (the version pinned in package.json and the Dockerfile).
 */
const { createRateLimiter } = require('./rateLimitEngine.mjs')

const limiter = createRateLimiter({
  // Slug = full project folder name (matches the central control-sheet rows).
  project: 'ail-ay2627-s1-kaavya-touchgrass',
  buckets: {
    vision: Number(process.env.RATE_LIMIT_VISION_MAX || 5),
    activities: Number(process.env.RATE_LIMIT_ACTIVITIES_MAX || 5),
  },
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_URL,
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.UPSTASH_REDIS_TOKEN,
  defaultWindow: Number(process.env.RATE_LIMIT_WINDOW_SECONDS || 432000),
})

module.exports = { limitVision: limiter('vision'), limitActivities: limiter('activities') }
