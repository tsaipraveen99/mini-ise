export type Effect = 'allow' | 'deny' | 'quarantine'

export type Op = 'eq' | 'neq' | 'in' | 'not_in' | 'gte' | 'lt'

export interface Condition {
  attribute: string
  op: Op
  value: string | number | boolean | string[]
}

export interface PolicyBase {
  name: string
  description: string
  priority: number
  effect: Effect
  reason: string
  conditions: Condition[]
}

export interface Policy extends PolicyBase {
  id: number
  enabled: boolean
  source: string
}

export interface DecisionRow {
  id: number
  decided_at: string
  user_name: string
  role: string
  device_id: string
  resource: string
  location: string
  hour: number
  effect: Effect
  reason: string
  policy_id: number | null
  served_by: string
  latency_ms: number
}

export interface Stats {
  window_seconds: number
  by_effect: Partial<Record<Effect, number>>
  by_pod: Record<string, number>
}

export interface DraftResult {
  feasible: boolean
  explanation: string
  interpretation: string
  suggestions: string[]
  policy: PolicyBase | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  })
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`
    try {
      const body = await response.json()
      detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // Keep the status line when the body isn't JSON.
    }
    throw new Error(detail)
  }
  return response.status === 204 ? (undefined as T) : response.json()
}

export const api = {
  policies: () => request<Policy[]>('/v1/policies'),
  decisions: (limit = 25) => request<DecisionRow[]>(`/v1/decisions?limit=${limit}`),
  stats: () => request<Stats>('/v1/stats?window=60'),
  draft: (text: string) =>
    request<DraftResult>('/v1/policies/draft', { method: 'POST', body: JSON.stringify({ text }) }),
  createPolicy: (policy: PolicyBase) =>
    request<Policy>('/v1/policies', { method: 'POST', body: JSON.stringify({ ...policy, source: 'ai' }) }),
  setEnabled: (id: number, enabled: boolean) =>
    request<Policy>(`/v1/policies/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
}
