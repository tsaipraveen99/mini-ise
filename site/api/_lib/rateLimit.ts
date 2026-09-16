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
  perVisitorPerDay: positiveInt(process.env.DRAFTS_PER_VISITOR_PER_DAY, 10),
  globalPerDay: positiveInt(process.env.DRAFTS_PER_DAY, 100),
}

interface Limiter {
  limit(key: string): Promise<{ success: boolean; reset: number }>
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

/**
 * Fallback when no Redis store is connected. Counts live in one server instance's memory, so a visitor
 * who lands on several instances can exceed the limits; the prepaid API balance is the hard ceiling.
 */
function memoryLimiter(max: number, windowMs: number): Limiter {
  const windows = new Map<string, { count: number; reset: number }>()
  return {
    async limit(key) {
      const now = Date.now()
      let entry = windows.get(key)
      if (!entry || entry.reset <= now) {
        entry = { count: 0, reset: now + windowMs }
        windows.set(key, entry)
      }
      if (entry.count >= max) return { success: false, reset: entry.reset }
      entry.count += 1
      return { success: true, reset: entry.reset }
    },
  }
}

function buildLimiters(): { store: 'redis' | 'memory'; minute: Limiter; visitorDay: Limiter; globalDay: Limiter } {
  if (url && token) {
    const redis = new Redis({ url, token })
    return {
      store: 'redis',
      minute: new Ratelimit({ redis, prefix: 'draft:minute', limiter: Ratelimit.slidingWindow(LIMITS.perVisitorPerMinute, '1 m') }),
      visitorDay: new Ratelimit({ redis, prefix: 'draft:visitor-day', limiter: Ratelimit.fixedWindow(LIMITS.perVisitorPerDay, '1 d') }),
      globalDay: new Ratelimit({ redis, prefix: 'draft:global-day', limiter: Ratelimit.fixedWindow(LIMITS.globalPerDay, '1 d') }),
    }
  }
  return {
    store: 'memory',
    minute: memoryLimiter(LIMITS.perVisitorPerMinute, MINUTE),
    visitorDay: memoryLimiter(LIMITS.perVisitorPerDay, DAY),
    globalDay: memoryLimiter(LIMITS.globalPerDay, DAY),
  }
}

const limiters = buildLimiters()
export const LIMIT_STORE = limiters.store

export type LimitResult = { ok: true } | { ok: false; status: 429; message: string; retryAfterSeconds: number }

const secondsUntil = (resetMs: number) => Math.max(1, Math.ceil((resetMs - Date.now()) / 1000))

export async function checkLimits(visitor: string): Promise<LimitResult> {
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
