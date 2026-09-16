import { afterEach, describe, expect, it, vi } from 'vitest'

const SITE = 'https://mini-ise.vercel.app'

const post = (body: unknown, headers: Record<string, string> = { origin: SITE }) =>
  new Request(`${SITE}/api/draft`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })

async function loadHandler(env: Record<string, string>) {
  vi.resetModules()
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  return import('../draft')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('POST /api/draft guards (no network)', () => {
  it('rejects requests from other sites', async () => {
    const { POST } = await loadHandler({})
    const response = await POST(post({ text: 'Contractors cannot use finance' }, { origin: 'https://evil.example' }))
    expect(response.status).toBe(403)
  })

  it('rejects text that is too short, too long or not JSON', async () => {
    const { POST } = await loadHandler({})
    expect((await POST(post({ text: 'hi' }))).status).toBe(400)
    expect((await POST(post({ text: 'x'.repeat(201) }))).status).toBe(400)
    expect((await POST(post('not json'))).status).toBe(400)
  })

  it('stays off without an API key', async () => {
    const { POST } = await loadHandler({ ANTHROPIC_PUBLIC_API_KEY: '' })
    const response = await POST(post({ text: 'Contractors cannot use finance' }))
    expect(response.status).toBe(503)
  })

  it('only accepts POST', async () => {
    const { GET } = await loadHandler({})
    expect(GET().status).toBe(405)
  })
})
