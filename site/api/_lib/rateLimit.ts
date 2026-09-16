import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

// The Vercel Marketplace integration may name these either way.
const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

const positiveInt = (value: string | undefined, fallback: number) => {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : fallback
}

export const LIMITS = {
  perVisitorPerMinute: positiveInt(process.env.DRAFTS_PER_VISITOR_PER_MINUTE, 3),
  perVisitorPerDay: positiveInt(process.env.DRAFTS_PER_VISITOR_PER_DAY, 8),
  globalPerDay: positiveInt(process.env.DRAFTS_PER_DAY, 15),
}

const redis = url && token ? new Redis({ url, token }) : null

const limiters = redis && {
  minute: new Ratelimit({
    redis,
    prefix: 'draft:minute',
    limiter: Ratelimit.slidingWindow(LIMITS.perVisitorPerMinute, '1 m'),
  }),
  visitorDay: new Ratelimit({
    redis,
    prefix: 'draft:visitor-day',
    limiter: Ratelimit.fixedWindow(LIMITS.perVisitorPerDay, '1 d'),
  }),
  globalDay: new Ratelimit({
    redis,
    prefix: 'draft:global-day',
    limiter: Ratelimit.fixedWindow(LIMITS.globalPerDay, '1 d'),
  }),
}

export type LimitResult = { ok: true } | { ok: false; status: 429 | 503; message: string; retryAfterSeconds?: number }

const secondsUntil = (resetMs: number) => Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))

/** Fails closed: without a shared store there are no reliable limits, so drafting stays off. */
export async function checkLimits(visitor: string): Promise<LimitResult> {
  if (!limiters) {
    return { ok: false, status: 503, message: 'AI drafting is not set up on this site yet.' }
  }
  const minute = await limiters.minute.limit(visitor)
  if (!minute.success) {
    return {
      ok: false,
      status: 429,
      message: 'Too many drafts in a row. Wait a minute and try again.',
      retryAfterSeconds: secondsUntil(minute.reset),
    }
  }
  const visitorDay = await limiters.visitorDay.limit(visitor)
  if (!visitorDay.success) {
    return {
      ok: false,
      status: 429,
      message: 'You’ve used today’s drafts. Try again tomorrow.',
      retryAfterSeconds: secondsUntil(visitorDay.reset),
    }
  }
  // Checked last so one visitor's rejected attempts don't use up everyone's allowance.
  const globalDay = await limiters.globalDay.limit('global')
  if (!globalDay.success) {
    return {
      ok: false,
      status: 429,
      message: 'AI drafting has reached today’s limit for this demo. The engine still works; try drafting again tomorrow.',
      retryAfterSeconds: secondsUntil(globalDay.reset),
    }
  }
  return { ok: true }
}
