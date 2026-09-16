import { useState } from 'react'
import { api, type DecisionRow, type DraftResult, type Effect, type Policy, type PolicyBase, type Stats } from './api'
import { describeCondition, formatTime } from './lib'

export function EffectBadge({ effect }: { effect: Effect }) {
  return <span className={`badge badge-${effect}`}>{effect}</span>
}

export function StatsBar({ stats }: { stats: Stats | null }) {
  const effects: Effect[] = ['allow', 'deny', 'quarantine']
  const total = effects.reduce((sum, e) => sum + (stats?.by_effect[e] ?? 0), 0)
  const pods = Object.entries(stats?.by_pod ?? {}).sort(([a], [b]) => a.localeCompare(b))

  return (
    <section className="stats">
      <div className="stat">
        <span className="stat-label">Decisions / sec</span>
        <span className="stat-value">{stats ? (total / stats.window_seconds).toFixed(1) : '·'}</span>
        <span className="stat-sub">last 60 seconds</span>
      </div>
      {effects.map((effect) => {
        const count = stats?.by_effect[effect] ?? 0
        return (
          <div key={effect} className={`stat stat-${effect}`}>
            <span className="stat-label">{effect}</span>
            <span className="stat-value">{count}</span>
            <span className="stat-sub">{total ? Math.round((count / total) * 100) : 0}%</span>
          </div>
        )
      })}
      <div className="stat stat-pods">
        <span className="stat-label">Serving pods</span>
        <span className="stat-value">{pods.length}</span>
        <ul className="pod-list">
          {pods.map(([pod, count]) => (
            <li key={pod}>
              <code>{pod}</code> <span>{count}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export function DecisionFeed({ decisions }: { decisions: DecisionRow[] | null }) {
  return (
    <section className="card feed">
      <header className="card-header">
        <h2>Live decisions</h2>
        <span className="muted">newest first</span>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Resource</th>
              <th>Device</th>
              <th>Hour</th>
              <th>Decision</th>
              <th>Reason</th>
              <th>Pod</th>
            </tr>
          </thead>
          <tbody>
            {decisions?.map((d) => (
              <tr key={d.id}>
                <td className="mono">{formatTime(d.decided_at)}</td>
                <td>{d.user_name}</td>
                <td>{d.resource}</td>
                <td className="mono">{d.device_id}</td>
                <td className="mono">{String(d.hour).padStart(2, '0')}:00</td>
                <td>
                  <EffectBadge effect={d.effect} />
                </td>
                <td className="reason">{d.reason}</td>
                <td className="mono muted">{d.served_by}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {decisions?.length === 0 && <p className="empty">No decisions yet. Start the device simulator.</p>}
      </div>
    </section>
  )
}

function PolicySummary({ policy }: { policy: PolicyBase }) {
  return (
    <>
      <div className="policy-title">
        <span className="priority" title="Priority: lower runs first">
          {policy.priority}
        </span>
        <strong>{policy.name}</strong>
        <EffectBadge effect={policy.effect} />
      </div>
      <ul className="conditions">
        {policy.conditions.map((c, i) => (
          <li key={i}>{describeCondition(c)}</li>
        ))}
      </ul>
      <p className="muted small">Reason shown to user: “{policy.reason}”</p>
    </>
  )
}

const EXAMPLES = [
  'Contractors cannot reach finance after 6pm',
  'Quarantine unpatched devices connecting remotely',
  'Guests cannot use the network at night',
]

export function PolicyDrafter({ onApproved }: { onApproved: () => void }) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState<'drafting' | 'saving' | null>(null)
  const [draft, setDraft] = useState<DraftResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runDraft = async () => {
    setBusy('drafting')
    setDraft(null)
    setError(null)
    try {
      setDraft(await api.draft(text.trim()))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  const approve = async (policy: PolicyBase) => {
    setBusy('saving')
    setError(null)
    try {
      await api.createPolicy(policy)
      setDraft(null)
      setText('')
      onApproved()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="card drafter">
      <header className="card-header">
        <h2>Describe a rule</h2>
        <span className="muted">AI drafts · you approve · code enforces</span>
      </header>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Contractors cannot reach finance after 6pm"
        rows={2}
        maxLength={500}
      />
      <div className="examples">
        {EXAMPLES.map((example) => (
          <button key={example} type="button" className="chip" onClick={() => setText(example)}>
            {example}
          </button>
        ))}
      </div>
      <button className="primary" type="button" disabled={text.trim().length < 5 || busy !== null} onClick={runDraft}>
        {busy === 'drafting' ? 'Drafting…' : 'Draft policy'}
      </button>

      {error && <p className="notice notice-error">{error}</p>}

      {draft?.interpretation && (
        <p className="interpretation">
          <span>I understood:</span> {draft.interpretation}
        </p>
      )}

      {draft && !draft.feasible && (
        <div className="notice notice-warn">
          <p>{draft.explanation}</p>
          {draft.suggestions.length > 0 && (
            <>
              <p className="suggestions-label">Try one of these instead:</p>
              <div className="suggestions">
                {draft.suggestions.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="chip suggestion"
                    onClick={() => {
                      setText(suggestion)
                      setDraft(null)
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {draft?.feasible && draft.policy && (
        <div className="draft">
          <p className="muted small">AI draft: review before it goes live</p>
          <PolicySummary policy={draft.policy} />
          <p className="small">{draft.explanation}</p>
          <div className="actions">
            <button className="primary" type="button" disabled={busy !== null} onClick={() => approve(draft.policy!)}>
              {busy === 'saving' ? 'Saving…' : 'Approve and activate'}
            </button>
            <button type="button" disabled={busy !== null} onClick={() => setDraft(null)}>
              Discard
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

export function PolicyList({ policies, onChanged }: { policies: Policy[] | null; onChanged: () => void }) {
  const [pendingId, setPendingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const toggle = async (policy: Policy) => {
    setPendingId(policy.id)
    setError(null)
    try {
      await api.setEnabled(policy.id, !policy.enabled)
      onChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="card policies">
      <header className="card-header">
        <h2>Policies</h2>
        <span className="muted">first match wins · no match means deny</span>
      </header>
      {error && <p className="notice notice-error">{error}</p>}
      <ol>
        {policies?.map((policy) => (
          <li key={policy.id} className={policy.enabled ? '' : 'disabled'}>
            <div className="policy-body">
              <PolicySummary policy={policy} />
              {policy.source === 'ai' && <span className="source">drafted by AI</span>}
            </div>
            <label className="switch" title={policy.enabled ? 'Disable' : 'Enable'}>
              <input
                type="checkbox"
                checked={policy.enabled}
                disabled={pendingId === policy.id}
                onChange={() => toggle(policy)}
              />
              <span aria-hidden="true" />
              <span className="sr-only">{policy.enabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </li>
        ))}
      </ol>
    </section>
  )
}
