import { describe, expect, it } from 'vitest'
import shared from '../../fixtures/policy-cases.json'
import { SEED_POLICIES, evaluate, traceDecision, type AccessRequest, type Policy } from './engine'

const employee: AccessRequest = {
  role: 'employee',
  resource: 'email',
  location: 'office',
  device_managed: true,
  device_encrypted: true,
  device_patched: true,
  hour: 10,
}

describe('browser engine agrees with the Python service', () => {
  it.each(shared.cases)('$name', (c) => {
    const decision = evaluate(SEED_POLICIES, c.request as unknown as AccessRequest)
    expect({ effect: decision.effect, policy_id: decision.policyId }).toEqual(c.expected)
  })
})

describe('evaluation order', () => {
  const rolePolicy = (id: number, priority: number, extra: Partial<Policy> = {}): Policy => ({
    id,
    name: `policy ${id}`,
    description: '',
    priority,
    effect: 'allow',
    reason: `policy ${id}`,
    conditions: [{ attribute: 'role', op: 'eq', value: 'employee' }],
    ...extra,
  })

  it('checks lower priority numbers first', () => {
    expect(evaluate([rolePolicy(1, 50), rolePolicy(2, 5)], employee).policyId).toBe(2)
  })

  it('breaks priority ties by id', () => {
    expect(evaluate([rolePolicy(9, 10), rolePolicy(3, 10)], employee).policyId).toBe(3)
  })

  it('skips disabled policies and falls back to default deny', () => {
    const decision = evaluate([rolePolicy(1, 1, { enabled: false })], employee)
    expect(decision).toEqual({ effect: 'deny', reason: 'No policy matched (default deny)', policyId: null })
  })

  it('records a result for every condition of every policy', () => {
    const trace = traceDecision(SEED_POLICIES, { ...employee, device_encrypted: false })
    expect(trace.matchIndex).toBe(0)
    expect(trace.steps).toHaveLength(SEED_POLICIES.length)
    expect(trace.steps.every((s) => s.results.length === s.policy.conditions.length)).toBe(true)
  })
})
