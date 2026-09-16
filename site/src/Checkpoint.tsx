import { useEffect, useId, useMemo, useState } from 'react'
import {
  LOCATIONS,
  RESOURCES,
  ROLES,
  SEED_POLICIES,
  describeCondition,
  formatHour,
  traceDecision,
  type AccessRequest,
} from './engine'

const STEP_MS = 150

const PRESETS: { label: string; request: AccessRequest }[] = [
  {
    label: 'Employee, company laptop',
    request: {
      role: 'employee',
      resource: 'email',
      location: 'office',
      device_managed: true,
      device_encrypted: true,
      device_patched: true,
      hour: 10,
    },
  },
  {
    label: 'Contractor, personal laptop, 7pm',
    request: {
      role: 'contractor',
      resource: 'finance',
      location: 'remote',
      device_managed: false,
      device_encrypted: true,
      device_patched: true,
      hour: 19,
    },
  },
  {
    label: 'Unencrypted laptop',
    request: {
      role: 'employee',
      resource: 'engineering',
      location: 'office',
      device_managed: true,
      device_encrypted: false,
      device_patched: true,
      hour: 9,
    },
  },
  {
    label: 'Guest phone on the wiki',
    request: {
      role: 'guest',
      resource: 'wiki',
      location: 'office',
      device_managed: false,
      device_encrypted: true,
      device_patched: true,
      hour: 14,
    },
  },
]

type RowState = 'pending' | 'checking' | 'miss' | 'match' | 'skipped'

function usePrefersReducedMotion(): boolean {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  return reduced
}

function Segmented<T extends string>({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="cp-field">
      <legend>{legend}</legend>
      <div className="cp-segmented">
        {options.map((option) => (
          <label key={option} className={option === value ? 'is-on' : ''}>
            <input type="radio" name={name} value={option} checked={option === value} onChange={() => onChange(option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function Checkpoint({ compact = false }: { compact?: boolean }) {
  const [request, setRequest] = useState<AccessRequest>(PRESETS[0].request)
  const trace = useMemo(() => traceDecision(SEED_POLICIES, request), [request])
  const { steps, matchIndex, decision } = trace
  // The walk visits every policy up to the first match, then the default row if nothing matched.
  const finalCursor = matchIndex >= 0 ? matchIndex + 1 : steps.length + 1

  const reducedMotion = usePrefersReducedMotion()
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (reducedMotion) {
      setCursor(finalCursor)
      return
    }
    setCursor(0)
    const timer = window.setInterval(() => {
      setCursor((c) => {
        if (c >= finalCursor) {
          window.clearInterval(timer)
          return c
        }
        return c + 1
      })
    }, STEP_MS)
    return () => window.clearInterval(timer)
  }, [trace, finalCursor, reducedMotion])

  const done = cursor >= finalCursor
  const update = <K extends keyof AccessRequest>(key: K, value: AccessRequest[K]) =>
    setRequest((current) => ({ ...current, [key]: value }))

  const rowState = (index: number): RowState => {
    if (matchIndex >= 0 && index > matchIndex) return 'skipped'
    if (cursor > index) return index === matchIndex ? 'match' : 'miss'
    return cursor === index ? 'checking' : 'pending'
  }
  const defaultState: RowState =
    matchIndex >= 0 ? 'skipped' : cursor > steps.length ? 'match' : cursor === steps.length ? 'checking' : 'pending'

  const matched = matchIndex >= 0 ? steps[matchIndex].policy : null
  const activePreset = PRESETS.find((p) => JSON.stringify(p.request) === JSON.stringify(request))

  return (
    <section className={`checkpoint${compact ? ' checkpoint--compact' : ''}`} aria-label="Policy engine">
      <div className="cp-request">
        <p className="cp-step">
          <span className="cp-step-n">1</span>Describe the device
        </p>
        <p className="cp-help">Pick an example, or set each detail yourself.</p>
        <p className="cp-sublabel">Examples</p>
        <div className="cp-presets" role="group" aria-label="Example requests">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              className={preset === activePreset ? 'is-on' : ''}
              aria-pressed={preset === activePreset}
              onClick={() => setRequest(preset.request)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <Segmented legend="Role" options={ROLES} value={request.role} onChange={(v) => update('role', v)} />
        <Segmented legend="Resource" options={RESOURCES} value={request.resource} onChange={(v) => update('resource', v)} />
        <Segmented legend="Location" options={LOCATIONS} value={request.location} onChange={(v) => update('location', v)} />

        <fieldset className="cp-field">
          <legend>Device</legend>
          <div className="cp-toggles">
            {(
              [
                ['device_managed', 'Company managed'],
                ['device_encrypted', 'Disk encrypted'],
                ['device_patched', 'Patched'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className={`cp-toggle${request[key] ? ' is-on' : ''}`}>
                <input type="checkbox" checked={request[key]} onChange={(e) => update(key, e.target.checked)} />
                <span aria-hidden="true" className="cp-toggle-light" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="cp-field cp-hour">
          <span className="cp-legend">Time</span>
          <input
            type="range"
            min={0}
            max={23}
            value={request.hour}
            onChange={(e) => update('hour', Number(e.target.value))}
            aria-valuetext={formatHour(request.hour)}
          />
          <output>{formatHour(request.hour)}</output>
        </label>
      </div>

      <div className="cp-walk">
        <p className="cp-step">
          <span className="cp-step-n">2</span>Policies are checked from the top
        </p>
        <p className="cp-help">The first policy where every condition is true decides. Nothing matching means deny.</p>
        <ul className="cp-legend-row" aria-label="Legend">
          <li>
            <span className="cp-key cp-key--pass">✓</span> condition true
          </li>
          <li>
            <span className="cp-key cp-key--fail">✗</span> condition false
          </li>
          <li>
            <span className="cp-key cp-key--match" /> policy that decided
          </li>
          <li>
            <span className="cp-key cp-key--faded" /> never reached
          </li>
        </ul>
        <ol className="cp-policies">
          {steps.map((step, index) => {
            const state = rowState(index)
            const evaluated = state === 'miss' || state === 'match'
            return (
              <li key={step.policy.id} className={`cp-row is-${state}`}>
                <span className="cp-priority">{step.policy.priority}</span>
                <div className="cp-row-main">
                  <span className="cp-row-name">{step.policy.name}</span>
                  <ul className="cp-conds">
                    {step.policy.conditions.map((condition, i) => (
                      <li key={i} className={evaluated ? (step.results[i] ? 'is-pass' : 'is-fail') : ''}>
                        {evaluated && (
                          <span className="cp-mark" aria-label={step.results[i] ? 'true' : 'false'}>
                            {step.results[i] ? '✓' : '✗'}
                          </span>
                        )}
                        {describeCondition(condition)}
                      </li>
                    ))}
                  </ul>
                </div>
                <span className={`cp-effect cp-effect--${step.policy.effect}`}>{step.policy.effect}</span>
              </li>
            )
          })}
          <li className={`cp-row cp-row--default is-${defaultState}`}>
            <span className="cp-priority">∞</span>
            <div className="cp-row-main">
              <span className="cp-row-name">Nothing matched</span>
              <ul className="cp-conds">
                <li>zero trust never allows by default</li>
              </ul>
            </div>
            <span className="cp-effect cp-effect--deny">deny</span>
          </li>
        </ol>
      </div>

      <div className={`cp-verdict cp-verdict--${done ? decision.effect : 'pending'}`} aria-live="polite">
        <p className="cp-step cp-step--verdict">
          <span className="cp-step-n">3</span>Decision
        </p>
        {done ? (
          <>
            <span className="cp-stamp">{decision.effect}</span>
            <div className="cp-verdict-text">
              <p className="cp-reason">{decision.reason}</p>
              <p className="cp-source">
                {matched
                  ? `Priority ${matched.priority}: ${matched.name}`
                  : 'No policy matched, so the request is denied'}
                {' · '}decided in your browser with the same rules as the Python service
              </p>
            </div>
          </>
        ) : (
          <span className="cp-checking">Checking policies…</span>
        )}
      </div>
    </section>
  )
}
