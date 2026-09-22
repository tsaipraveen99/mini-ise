/* On-slide demos.
   The decision feed runs the real browser engine (site/src/engine.ts) against
   generated device traffic — only the devices are invented. The cluster demo
   is a simulation and says so on the slide, because there is no Kubernetes in
   a browser. Both are manual: nothing moves until a button is pressed. */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  LOCATIONS,
  RESOURCES,
  ROLES,
  SEED_POLICIES,
  evaluate,
  formatHour,
  type AccessRequest,
  type Decision,
} from './engine'

const pick = <T,>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]
const chance = (p: number) => Math.random() < p

/** Weighted so the feed shows all three verdicts rather than a wall of allows. */
function randomRequest(): AccessRequest {
  return {
    role: pick(ROLES),
    resource: pick(RESOURCES),
    location: pick(LOCATIONS),
    device_managed: chance(0.7),
    device_encrypted: chance(0.78),
    device_patched: chance(0.78),
    hour: 7 + Math.floor(Math.random() * 15),
  }
}

interface Row {
  id: number
  request: AccessRequest
  decision: Decision
}

const FEED_LENGTH = 6

export function LiveDecisions() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const nextId = useRef(1)

  const send = useCallback(() => {
    const request = randomRequest()
    const decision = evaluate(SEED_POLICIES, request)
    setRows((current) => [{ id: nextId.current++, request, decision }, ...current].slice(0, FEED_LENGTH))
  }, [])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(send, 750)
    return () => window.clearInterval(timer)
  }, [running, send])

  const tally = (effect: string) => rows.filter((r) => r.decision.effect === effect).length

  return (
    <div className="d-demo">
      <div className="d-controls">
        <button type="button" className="d-btn d-btn--primary" onClick={() => setRunning((v) => !v)}>
          {running ? 'Pause' : 'Start traffic'}
        </button>
        <button type="button" className="d-btn" onClick={send}>
          Send one
        </button>
        <button type="button" className="d-btn" onClick={() => setRows([])}>
          Clear
        </button>
        <span className="d-badge d-badge--real">real engine · simulated devices</span>
      </div>

      <div className="d-feed" aria-live="polite">
        {rows.length === 0 && <p className="d-empty">Press start. Requests are evaluated by the same engine the pods run.</p>}
        {rows.map((row) => (
          <div className={`d-row d-row--${row.decision.effect}`} key={row.id}>
            <span className="d-who">
              {row.request.role} · {row.request.resource} · {row.request.location} · {formatHour(row.request.hour)}
            </span>
            <span className="d-chip">{row.decision.effect}</span>
            <span className="d-reason">{row.decision.reason}</span>
          </div>
        ))}
      </div>

      <div className="d-tally">
        <span>allow {tally('allow')}</span>
        <span>quarantine {tally('quarantine')}</span>
        <span>deny {tally('deny')}</span>
      </div>
    </div>
  )
}

interface Pod {
  id: number
  /** Ticks remaining before the pod passes its readiness check and gets traffic. */
  readyIn: number
  served: number
}

/** Derived from the pods themselves: a state updater must stay pure, and React
    calls it twice in StrictMode, so a mutable counter would skip numbers. */
const nextPodId = (pods: readonly Pod[]) => pods.reduce((max, p) => Math.max(max, p.id), 0) + 1

const TICK_MS = 400
const READY_TICKS = 4
const MIN_PODS = 2
const MAX_PODS = 6
const CPU_TARGET = 70
/** Requests per second one pod handles at 100% CPU. */
const POD_CAPACITY = 70

export function LiveAutoscale() {
  const [running, setRunning] = useState(false)
  const [high, setHigh] = useState(false)
  const [rps, setRps] = useState(40)
  const [pods, setPods] = useState<Pod[]>([
    { id: 1, readyIn: 0, served: 0 },
    { id: 2, readyIn: 0, served: 0 },
  ])
  const ready = pods.filter((p) => p.readyIn === 0)
  const cpu = ready.length === 0 ? 100 : Math.min(100, Math.round((rps / (ready.length * POD_CAPACITY)) * 100))

  // Read inside the interval without restarting it on every rps change.
  const rpsRef = useRef(rps)
  rpsRef.current = rps

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const target = high ? 260 : 40
      setRps((current) => current + (target - current) * 0.22)

      setPods((current) => {
        const readyPods = current.filter((p) => p.readyIn === 0)
        const load = readyPods.length === 0 ? 100 : (rpsRef.current / (readyPods.length * POD_CAPACITY)) * 100

        let next = current.map((p) => ({ ...p, readyIn: Math.max(0, p.readyIn - 1) }))
        // Ready pods share the traffic; a pod still loading policies gets none.
        const share = readyPods.length === 0 ? 0 : (rpsRef.current * (TICK_MS / 1000)) / readyPods.length
        next = next.map((p) => (p.readyIn === 0 ? { ...p, served: p.served + share } : p))

        if (load > CPU_TARGET && next.length < MAX_PODS) {
          next = [...next, { id: nextPodId(next), readyIn: READY_TICKS, served: 0 }]
        } else if (load < 30 && next.length > MIN_PODS && readyPods.length === next.length) {
          next = next.slice(0, -1)
        }
        return next
      })
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [running, high])

  const killPod = () => {
    setPods((current) => {
      if (current.length <= 1) return current
      const victim = current.findIndex((p) => p.readyIn === 0)
      const next = current.filter((_, i) => i !== (victim === -1 ? 0 : victim))
      // Self-healing: the replacement starts immediately and must pass readiness.
      return [...next, { id: nextPodId(next), readyIn: READY_TICKS, served: 0 }]
    })
  }

  const reset = () => {
    setRunning(false)
    setHigh(false)
    setRps(40)
    setPods([
      { id: 1, readyIn: 0, served: 0 },
      { id: 2, readyIn: 0, served: 0 },
    ])
  }

  return (
    <div className="d-demo">
      <div className="d-controls">
        <button type="button" className="d-btn d-btn--primary" onClick={() => setRunning((v) => !v)}>
          {running ? 'Pause' : 'Start'}
        </button>
        <button type="button" className="d-btn" onClick={() => setHigh((v) => !v)} aria-pressed={high}>
          Load: {high ? 'high' : 'normal'}
        </button>
        <button type="button" className="d-btn" onClick={killPod}>
          Kill a pod
        </button>
        <button type="button" className="d-btn" onClick={reset}>
          Reset
        </button>
        <span className="d-badge d-badge--sim">simulated cluster — not a live cluster</span>
      </div>

      <div className="d-stats">
        <div className="d-stat">
          <span className="d-stat-value">{Math.round(rps)}</span>
          <span className="d-stat-label">requests / sec</span>
        </div>
        <div className="d-stat d-stat--bar">
          <div className="d-bar">
            <span style={{ width: `${cpu}%` }} className={cpu > CPU_TARGET ? 'is-over' : undefined} />
            <i style={{ left: `${CPU_TARGET}%` }} aria-hidden="true" />
          </div>
          <span className="d-stat-label">
            CPU {cpu}% · target {CPU_TARGET}%
          </span>
        </div>
        <div className="d-stat">
          <span className="d-stat-value">{pods.length}</span>
          <span className="d-stat-label">pods (min {MIN_PODS}, max {MAX_PODS})</span>
        </div>
      </div>

      <div className="d-pods">
        {pods.map((pod) => (
          <div className={`d-pod${pod.readyIn > 0 ? ' d-pod--waiting' : ''}`} key={pod.id}>
            <span className="d-pod-name">pod-{String(pod.id).padStart(2, '0')}</span>
            <span className="d-pod-state">
              {pod.readyIn > 0 ? 'loading policies…' : `${Math.round(pod.served).toLocaleString()} decisions`}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
