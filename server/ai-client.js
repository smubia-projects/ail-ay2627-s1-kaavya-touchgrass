const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const baseUrl = (env = process.env) => ((env.API_BASE_URL || env.OPENROUTER_BASE_URL)?.trim() || OPENROUTER_BASE_URL).replace(/\/+$/, '')
// Cheap vision-capable default; override with OPENROUTER_MODEL (verified on openrouter.ai/api/v1/models).
const DEFAULT_MODEL = 'openai/gpt-4o-mini'
class AIError extends Error {
  constructor(status, message, providerStatus) { super(message); this.status = status; this.providerStatus = providerStatus }
}
function aiConfigured(env = process.env) { return !!(env.API_KEY || env.OPENROUTER_API_KEY)?.trim() }
async function chatCompletion({ messages, maxTokens = 500 }, { env = process.env, fetchImpl = fetch } = {}) {
  // 500, not 503: HTTP 503 is reserved for the rate-limit engine's "demo paused" kill switch.
  if (!aiConfigured(env)) throw new AIError(500, 'AI is not configured on the backend.')
  const signal = AbortSignal.timeout(60000)
  let response
  try {
    response = await fetchImpl(`${baseUrl(env)}/chat/completions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(env.API_KEY || env.OPENROUTER_API_KEY).trim()}`, 'X-Title': 'TouchGrass' },
      signal,
      body: JSON.stringify({ model: (env.MODEL_NAME || env.OPENROUTER_MODEL)?.trim() || DEFAULT_MODEL, messages, response_format: { type: 'json_object' }, max_tokens: maxTokens })
    })
  } catch (error) {
    throw new AIError(signal.aborted || error.name === 'TimeoutError' ? 504 : 502, signal.aborted || error.name === 'TimeoutError' ? 'AI provider timed out. Please retry.' : 'Could not reach the AI provider. Check backend connectivity.')
  }
  let data
  try { data = await response.json() } catch (error) {
    if (signal.aborted || error.name === 'TimeoutError') throw new AIError(504, 'AI provider timed out. Please retry.')
    // Some proxies return non-JSON error pages. Never echo provider bodies.
  }
  if (!response.ok || data?.error) {
    const providerError = data?.error
    const invalidRequest = providerError?.type === 'invalid_request_error' || providerError?.code === 'invalid_request_error'
    // Classify using provider fields, but never expose arbitrary provider text:
    // error bodies can echo request content, credentials, or authorization headers.
    if (invalidRequest) {
      const jsonFormat = typeof providerError.message === 'string' && /json/i.test(providerError.message) && /json_object|format/i.test(providerError.message)
      const error = new AIError(502, `AI provider HTTP ${response.status}: Provider request/configuration issue (invalid_request_error).${jsonFormat ? ' Check json instructions and structured response format.' : ' Check model and request settings.'}`, response.status)
      error.providerErrorType = 'invalid_request_error'
      throw error
    }
    const reasons = { 400: 'Provider rejected the request format.', 401: 'Provider rejected OPENROUTER_API_KEY.', 403: 'Provider denied access. Check key permissions or account status.', 402: 'Provider account has insufficient credit.', 404: 'Provider endpoint or model was not found.', 413: 'Provider rejected the request size.', 429: 'Provider rate limit or quota exceeded.' }
    throw new AIError(502, `AI provider HTTP ${response.status}: ${reasons[response.status] || 'Provider request failed.'}`, response.status)
  }
  if (!data) throw new AIError(502, 'AI provider returned invalid JSON.')
  return data
}
module.exports = { chatCompletion, AIError, aiConfigured, DEFAULT_MODEL, OPENROUTER_BASE_URL }
