import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import cases from '../../../fixtures/policy-validation-cases.json'
import schema from '../../../fixtures/draft-schema.json'
import { DRAFT_SCHEMA, EXISTING_POLICIES, SYSTEM_PROMPT } from './prompt'
import { FALLBACK_SUGGESTIONS, parseDraft, policyProblems } from './validation'

const fixture = (name: string) => readFileSync(new URL(`../../../fixtures/${name}`, import.meta.url), 'utf8')

describe('public drafting matches the console', () => {
  it('uses the same system prompt', () => {
    expect(SYSTEM_PROMPT).toBe(fixture('draft-system-prompt.txt'))
  })

  it('asks for the same output schema', () => {
    expect(DRAFT_SCHEMA).toEqual(schema)
  })

  it('describes the seed policies the same way', () => {
    expect(EXISTING_POLICIES).toBe(fixture('draft-existing-policies.txt'))
  })

  it.each(cases)('validation: $name', ({ policy, valid }) => {
    expect(policyProblems(policy).length === 0).toBe(valid)
  })
})

describe('parseDraft', () => {
  const valid = cases.find((c) => c.name === 'seed policy')!.policy

  it('offers a valid draft for approval', () => {
    const result = parseDraft(
      JSON.stringify({ feasible: true, explanation: 'ok', interpretation: 'You want x.', suggestions: ['a'], policy: valid }),
    )
    expect(result.feasible).toBe(true)
    expect(result.policy?.name).toBe(valid.name)
    expect(result.suggestions).toEqual([])
  })

  it('refuses a catch-all draft with a readable reason and suggestions', () => {
    const result = parseDraft(
      JSON.stringify({
        feasible: true,
        explanation: 'ok',
        interpretation: 'You want everything.',
        suggestions: [],
        policy: { ...valid, conditions: [] },
      }),
    )
    expect(result.feasible).toBe(false)
    expect(result.explanation).toContain('at least one condition')
    expect(result.suggestions).toEqual(FALLBACK_SUGGESTIONS)
  })

  it('keeps and cleans the model suggestions when a rule is infeasible', () => {
    const noisy = ['  Allow guests to use the wiki ', '', 7, 'Allow guests to use the wiki', 'x'.repeat(200), 'a', 'b', 'c']
    const result = parseDraft(JSON.stringify({ feasible: false, explanation: 'no', suggestions: noisy, policy: null }))
    expect(result.suggestions).toEqual(['Allow guests to use the wiki', 'a', 'b'])
  })
})
