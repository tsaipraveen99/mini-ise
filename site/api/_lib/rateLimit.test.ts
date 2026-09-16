import { afterEach, describe, expect, it, vi } from 'vitest'

async function loadLimits(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import('./rateLimit')
}

const withoutRedis = {
  UPSTASH_REDIS_REST_URL: '',
  UPSTASH_REDIS_REST_TOKEN: '',
  KV_REST_API_URL: '',
  KV_REST_API_TOKEN: '',
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('rate limits without Redis (in-memory fallback)', () => {
  it('uses memory when no store is configured', async () => {
    const { LIMIT_STORE } = await loadLimits(withoutRedis)
    expect(LIMIT_STORE).toBe('memory')
  })

  it('stops a visitor after the per-minute limit', async () => {
    const { checkLimits } = await loadLimits({ ...withoutRedis, DRAFTS_PER_VISITOR_PER_MINUTE: '3' })
    for (let i = 0; i < 3; i++) expect((await checkLimits('203.0.113.7')).ok).toBe(true)
    const blocked = await checkLimits('203.0.113.7')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) {
      expect(blocked.status).toBe(429)
      expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    }
    // Other visitors are unaffected.
    expect((await checkLimits('198.51.100.4')).ok).toBe(true)
  })

  it('stops everyone once the daily total is used', async () => {
    const { checkLimits } = await loadLimits({ ...withoutRedis, DRAFTS_PER_DAY: '2' })
    expect((await checkLimits('a')).ok).toBe(true)
    expect((await checkLimits('b')).ok).toBe(true)
    const blocked = await checkLimits('c')
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.message).toContain('today’s limit')
  })
})
