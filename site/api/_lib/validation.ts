// TypeScript port of PolicyBase validation (backend/src/mini_ise/rules.py) and parse_draft
// (backend/src/mini_ise/llm.py). Both implementations run fixtures/policy-validation-cases.json.
import type { Condition, Policy } from '../../src/engine'
import { ATTRIBUTES, EFFECTS, LOCATIONS, OPS, RESOURCES, ROLES } from '../../src/vocab.js'

export type DraftPolicy = Omit<Policy, 'id' | 'enabled'>

export interface DraftResult {
  feasible: boolean
  explanation: string
  interpretation: string
  suggestions: string[]
  policy: DraftPolicy | null
}

export const MAX_SUGGESTIONS = 3
export const MAX_SUGGESTION_LENGTH = 120

export const FALLBACK_SUGGESTIONS = [
  'Allow employees on managed devices to reach every resource',
  'Contractors cannot reach finance after 6pm',
  'Quarantine unpatched devices connecting remotely',
]

const VOCABULARY: Partial<Record<string, readonly string[]>> = {
  role: ROLES,
  resource: RESOURCES,
  location: LOCATIONS,
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isString = (value: unknown, min: number, max: number): value is string =>
  typeof value === 'string' && value.length >= min && value.length <= max

function conditionProblem(raw: unknown, position: number): string | null {
  const at = `condition ${position}`
  if (!isRecord(raw)) return `${at}: must be an object`
  const { attribute, op, value } = raw
  if (typeof attribute !== 'string' || !(ATTRIBUTES as readonly string[]).includes(attribute)) {
    return `${at}: unknown attribute`
  }
  if (typeof op !== 'string' || !(OPS as readonly string[]).includes(op)) return `${at}: unknown operator`

  const allowed = VOCABULARY[attribute]
  if (allowed) {
    if (op === 'eq' || op === 'neq') {
      return typeof value === 'string' && allowed.includes(value)
        ? null
        : `${at}: ${attribute} ${op} needs one of ${allowed.join(', ')}`
    }
    if (op === 'in' || op === 'not_in') {
      const ok =
        Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === 'string' && allowed.includes(v))
      return ok ? null : `${at}: ${attribute} ${op} needs a non-empty list from ${allowed.join(', ')}`
    }
    return `${at}: operator ${op} is not valid for ${attribute}`
  }
  if (attribute === 'hour') {
    if (op === 'in' || op === 'not_in') return `${at}: operator ${op} is not valid for hour`
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 23
      ? null
      : `${at}: hour needs an integer from 0 to 23`
  }
  if (op !== 'eq' && op !== 'neq') return `${at}: operator ${op} is not valid for ${attribute}`
  return typeof value === 'boolean' ? null : `${at}: ${attribute} needs true or false`
}

/** Returns the problems with a policy, or an empty list when it would pass the Python validation. */
export function policyProblems(raw: unknown): string[] {
  if (!isRecord(raw)) return ['a policy must be an object']
  const problems: string[] = []
  if (!isString(raw.name, 1, 120)) problems.push('name must be 1 to 120 characters')
  if (raw.description !== undefined && !isString(raw.description, 0, 500)) {
    problems.push('description must be at most 500 characters')
  }
  const priority = raw.priority
  if (typeof priority !== 'number' || !Number.isInteger(priority) || priority < 1 || priority > 1000) {
    problems.push('priority must be between 1 and 1000')
  }
  if (typeof raw.effect !== 'string' || !(EFFECTS as readonly string[]).includes(raw.effect)) {
    problems.push('effect must be allow, deny or quarantine')
  }
  if (!isString(raw.reason, 1, 200)) problems.push('reason must be 1 to 200 characters')

  if (!Array.isArray(raw.conditions)) {
    problems.push('conditions must be a list')
  } else if (raw.conditions.length === 0) {
    problems.push(
      'a policy needs at least one condition. A policy that matches every request would override all other policies and the default deny',
    )
  } else if (raw.conditions.length > 10) {
    problems.push('a policy can have at most 10 conditions')
  } else {
    raw.conditions.forEach((condition, i) => {
      const problem = conditionProblem(condition, i + 1)
      if (problem) problems.push(problem)
    })
  }
  return problems
}

function cleanSuggestions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const cleaned = raw
    .filter((s): s is string => typeof s === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
  return [...new Set(cleaned)].filter((s) => s.length <= MAX_SUGGESTION_LENGTH).slice(0, MAX_SUGGESTIONS)
}

/** Mirrors parse_draft: a draft that fails validation is never offered for approval. */
export function parseDraft(rawJson: string): DraftResult {
  const data: unknown = JSON.parse(rawJson)
  const record = isRecord(data) ? data : {}
  const interpretation = typeof record.interpretation === 'string' ? record.interpretation : ''
  const explanation = typeof record.explanation === 'string' ? record.explanation : ''

  if (!record.feasible || record.policy == null) {
    const suggestions = cleanSuggestions(record.suggestions)
    return {
      feasible: false,
      explanation: explanation || 'The rule could not be drafted.',
      interpretation,
      suggestions: suggestions.length ? suggestions : FALLBACK_SUGGESTIONS,
      policy: null,
    }
  }

  const problems = policyProblems(record.policy)
  if (problems.length) {
    return {
      feasible: false,
      explanation: `The AI draft can't be used: ${[...new Set(problems)].join('; ')}.`,
      interpretation,
      suggestions: FALLBACK_SUGGESTIONS,
      policy: null,
    }
  }

  const policy = record.policy as Record<string, unknown>
  return {
    feasible: true,
    explanation,
    interpretation,
    suggestions: [],
    policy: {
      name: policy.name as string,
      description: typeof policy.description === 'string' ? policy.description : '',
      priority: policy.priority as number,
      effect: policy.effect as DraftPolicy['effect'],
      reason: policy.reason as string,
      conditions: policy.conditions as Condition[],
    },
  }
}
