import { useState } from 'react'
import { flushSync } from 'react-dom'
import type { DraftPolicy, DraftResult } from '../api/_lib/validation'
import { describeCondition } from './engine'

const MAX_TEXT = 200

const EXAMPLES = [
  'Contractors cannot use finance from home',
  'Quarantine guest devices after 8pm',
  'Allow everything for everyone',
]

type Status = { kind: 'idle' } | { kind: 'drafting' } | { kind: 'error'; message: string }

async function requestDraft(text: string): Promise<DraftResult> {
  const response = await fetch('/api/draft', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  const body = (await response.json().catch(() => ({}))) as Partial<DraftResult> & { error?: string }
  if (!response.ok) throw new Error(body.error ?? `Drafting failed (${response.status}).`)
  return body as DraftResult
}

export function AiDrafter({ onApprove, added }: { onApprove: (policy: DraftPolicy) => void; added: number }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [justAdded, setJustAdded] = useState(false)

  const drafting = status.kind === 'drafting'
  const canDraft = text.trim().length >= 5 && !drafting

  const submit = async () => {
    flushSync(() => {
      setStatus({ kind: 'drafting' })
      setDraft(null)
      setJustAdded(false)
    })
    try {
      setDraft(await requestDraft(text.trim()))
      setStatus({ kind: 'idle' })
    } catch (error) {
      setStatus({ kind: 'error', message: error instanceof Error ? error.message : 'Drafting failed.' })
    }
  }

  const pickText = (value: string) => {
    setText(value)
    setDraft(null)
  }

  const approve = (policy: DraftPolicy) => {
    onApprove(policy)
    setDraft(null)
    setText('')
    setJustAdded(true)
  }

  return (
    <section className="ai-drafter" aria-labelledby="ai-title">
      <div className="ai-head">
        <p className="ai-badge">Live AI</p>
        <h2 id="ai-title">Add your own rule with Claude</h2>
        <p>
          Describe a rule in plain English. Claude drafts it as a policy, you approve it, and the engine below starts
          using it. Your rules stay in this browser tab and are never saved.
        </p>
      </div>

      <form
        className="ai-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (canDraft) void submit()
        }}
      >
        <label className="sr-only" htmlFor="ai-text">
          Rule in plain English
        </label>
        <textarea
          id="ai-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="e.g. Contractors cannot use finance from home"
          maxLength={MAX_TEXT}
          rows={2}
        />
        <div className="ai-form-row">
          <div className="ai-examples" role="group" aria-label="Example rules">
            {EXAMPLES.map((example) => (
              <button key={example} type="button" className="chip" onClick={() => pickText(example)}>
                {example}
              </button>
            ))}
          </div>
          <span className="ai-count">
            {text.length}/{MAX_TEXT}
          </span>
        </div>
        <button type="submit" className="button button--primary" disabled={!canDraft} aria-busy={drafting}>
          {drafting ? (
            <>
              <span className="spinner" aria-hidden="true" />
              Claude is drafting…
            </>
          ) : (
            'Draft with Claude'
          )}
        </button>
      </form>

      <div aria-live="polite">
        {status.kind === 'error' && <p className="ai-notice ai-notice--error">{status.message}</p>}

        {justAdded && (
          <p className="ai-notice ai-notice--ok">Added to the engine. Set up a device below to see your rule decide.</p>
        )}

        {draft && (
          <div className="ai-result">
            {draft.interpretation && (
              <p className="ai-understood">
                <span>I understood:</span> {draft.interpretation}
              </p>
            )}

            {draft.feasible && draft.policy ? (
              <div className="ai-draft">
                <p className="ai-draft-label">Draft policy. Check it before approving.</p>
                <div className="ai-draft-title">
                  <span className="cp-priority">{draft.policy.priority}</span>
                  <strong>{draft.policy.name}</strong>
                  <span className={`cp-effect cp-effect--${draft.policy.effect}`}>{draft.policy.effect}</span>
                </div>
                <ul className="cp-conds">
                  {draft.policy.conditions.map((condition, i) => (
                    <li key={i}>{describeCondition(condition)}</li>
                  ))}
                </ul>
                <p className="ai-draft-reason">Reason shown to the user: “{draft.policy.reason}”</p>
                {draft.explanation && <p className="ai-draft-explain">{draft.explanation}</p>}
                <div className="ai-actions">
                  <button type="button" className="button button--primary" onClick={() => approve(draft.policy!)}>
                    Approve and add to engine
                  </button>
                  <button type="button" className="button button--quiet" onClick={() => setDraft(null)}>
                    Discard
                  </button>
                </div>
              </div>
            ) : (
              <div className="ai-notice ai-notice--warn">
                <p>{draft.explanation}</p>
                {draft.suggestions.length > 0 && (
                  <>
                    <p className="ai-suggest-label">Try one of these instead:</p>
                    <div className="ai-examples">
                      {draft.suggestions.map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="chip chip--suggestion"
                          onClick={() => pickText(suggestion)}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {added > 0 && (
        <p className="ai-added">
          {added} rule{added === 1 ? '' : 's'} added in this tab.
        </p>
      )}
    </section>
  )
}
