// The same first-match-wins evaluator as backend/src/mini_ise/rules.py, so the page can run
// real decisions without a server. engine.test.ts runs the shared cases in fixtures/ that the
// Python tests also run, which keeps the two implementations from drifting apart.
import shared from '../../fixtures/policy-cases.json'
import type { Attribute, Effect, Location, Op, Resource, Role } from './vocab'

export { LOCATIONS, RESOURCES, ROLES } from './vocab'
export type { Attribute, Effect, Location, Op, Resource, Role } from './vocab'

export interface Condition {
  attribute: Attribute
  op: Op
  value: string | number | boolean | string[]
}

export interface Policy {
  id: number
  name: string
  description: string
  priority: number
  effect: Effect
  reason: string
  conditions: Condition[]
  enabled?: boolean
  /** 'ai' marks a rule a visitor drafted with Claude and approved in this tab. */
  source?: string
}

export interface AccessRequest {
  role: Role
  resource: Resource
  location: Location
  device_managed: boolean
  device_encrypted: boolean
  device_patched: boolean
  hour: number
}

export interface Decision {
  effect: Effect
  reason: string
  policyId: number | null
}

export interface Step {
  policy: Policy
  /** One result per condition, in order. A policy matches when all are true. */
  results: boolean[]
  matched: boolean
}

export interface Trace {
  steps: Step[]
  /** Index of the first matching step, or -1 when nothing matched. */
  matchIndex: number
  decision: Decision
}

// The fixture JSON is validated against the Python models by the backend tests.
export const SEED_POLICIES = shared.policies as unknown as Policy[]

export const DEFAULT_DENY_REASON = 'No policy matched (default deny)'

export function conditionMatches(condition: Condition, request: AccessRequest): boolean {
  const actual = request[condition.attribute]
  const { op, value } = condition
  switch (op) {
    case 'eq':
      return actual === value
    case 'neq':
      return actual !== value
    case 'in':
      return Array.isArray(value) && value.includes(actual as string)
    case 'not_in':
      return Array.isArray(value) && !value.includes(actual as string)
    case 'gte':
      return typeof actual === 'number' && typeof value === 'number' && actual >= value
    case 'lt':
      return typeof actual === 'number' && typeof value === 'number' && actual < value
  }
}

export function orderPolicies(policies: readonly Policy[]): Policy[] {
  return policies.filter((p) => p.enabled !== false).sort((a, b) => a.priority - b.priority || a.id - b.id)
}

/** Evaluates every enabled policy in order and records why each one did or didn't match. */
export function traceDecision(policies: readonly Policy[], request: AccessRequest): Trace {
  const steps = orderPolicies(policies).map((policy) => {
    const results = policy.conditions.map((c) => conditionMatches(c, request))
    return { policy, results, matched: results.every(Boolean) }
  })
  const matchIndex = steps.findIndex((s) => s.matched)
  const decision: Decision =
    matchIndex >= 0
      ? { effect: steps[matchIndex].policy.effect, reason: steps[matchIndex].policy.reason, policyId: steps[matchIndex].policy.id }
      : { effect: 'deny', reason: DEFAULT_DENY_REASON, policyId: null }
  return { steps, matchIndex, decision }
}

export function evaluate(policies: readonly Policy[], request: AccessRequest): Decision {
  return traceDecision(policies, request).decision
}

const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  role: 'role',
  resource: 'resource',
  location: 'location',
  device_managed: 'managed device',
  device_encrypted: 'disk encrypted',
  device_patched: 'patched',
  hour: 'hour',
}

const OP_LABELS: Record<Op, string> = { eq: 'is', neq: 'is not', in: 'in', not_in: 'not in', gte: '≥', lt: '<' }

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`
}

export function describeCondition({ attribute, op, value }: Condition): string {
  let shown: string
  if (Array.isArray(value)) shown = value.join(', ')
  else if (typeof value === 'boolean') shown = value ? 'yes' : 'no'
  else if (attribute === 'hour') shown = formatHour(Number(value))
  else shown = String(value)
  return `${ATTRIBUTE_LABELS[attribute]} ${OP_LABELS[op]} ${shown}`
}
