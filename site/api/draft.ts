// POST /api/draft: turns a plain-English rule into a draft policy for the public engine page.
// Nothing is stored. Approved drafts live only in the visitor's browser.
import Anthropic from '@anthropic-ai/sdk'
import { DRAFT_SCHEMA, EXISTING_POLICIES, SYSTEM_PROMPT } from './_lib/prompt'
import { checkLimits } from './_lib/rateLimit'
import { parseDraft } from './_lib/validation'

const MODEL = process.env.PUBLIC_LLM_MODEL ?? 'claude-opus-5'
const MIN_TEXT = 5
const MAX_TEXT = 200

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers },
  })

const failure = (status: number, message: string, headers?: Record<string, string>) =>
  json(status, { error: message }, headers)

/** Only the site itself may call this; it blocks casual reuse of the endpoint from other pages. */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return request.headers.get('sec-fetch-site') === 'same-origin'
  return new URL(origin).host === new URL(request.url).host
}

function visitorId(request: Request): string {
  // Vercel sets x-forwarded-for; the first entry is the client.
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: Request): Promise<Response> {
  if (!isSameOrigin(request)) return failure(403, 'Requests must come from the Mini ISE site.')

  let text: unknown
  try {
    text = ((await request.json()) as { text?: unknown }).text
  } catch {
    return failure(400, 'Send JSON with a "text" field.')
  }
  if (typeof text !== 'string' || text.trim().length < MIN_TEXT || text.length > MAX_TEXT) {
    return failure(400, `Describe the rule in ${MIN_TEXT} to ${MAX_TEXT} characters.`)
  }

  const apiKey = process.env.ANTHROPIC_PUBLIC_API_KEY
  if (!apiKey) return failure(503, 'AI drafting is not set up on this site yet.')

  const limit = await checkLimits(visitorId(request))
  if (!limit.ok) {
    const headers = limit.retryAfterSeconds ? { 'retry-after': String(limit.retryAfterSeconds) } : undefined
    return failure(limit.status, limit.message, headers)
  }

  const client = new Anthropic({ apiKey, timeout: 30_000, maxRetries: 1 })
  let response: Anthropic.Beta.Messages.BetaMessage
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Low effort keeps a public demo cheap; drafting one policy is a small, well-specified task.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: DRAFT_SCHEMA } },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Existing policies:\n${EXISTING_POLICIES}\n\nRule to draft:\n${text.trim()}` }],
    })
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) return failure(503, 'The AI model is busy. Try again in a minute.')
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('draft: Anthropic rejected the key')
      return failure(503, 'AI drafting is unavailable right now.')
    }
    if (error instanceof Anthropic.APIError) {
      console.error('draft: Anthropic API error', error.status, error.requestID)
      return failure(503, 'AI drafting is unavailable right now.')
    }
    console.error('draft: unexpected error', error)
    return failure(502, 'AI drafting failed. Try again.')
  }

  if (response.stop_reason === 'refusal') {
    return json(200, {
      feasible: false,
      explanation: 'The model declined to draft this rule.',
      interpretation: '',
      suggestions: [],
      policy: null,
    })
  }
  if (response.stop_reason === 'max_tokens') return failure(502, 'The draft was cut off. Try a shorter rule.')

  const textBlock = response.content.find((block) => block.type === 'text')
  if (!textBlock || textBlock.type !== 'text') return failure(502, 'The model returned no draft.')

  try {
    return json(200, parseDraft(textBlock.text))
  } catch {
    return failure(502, 'The model returned a draft that could not be read.')
  }
}

export function GET(): Response {
  return failure(405, 'Use POST.', { allow: 'POST' })
}
