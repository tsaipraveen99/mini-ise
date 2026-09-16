import { useCallback, useEffect, useRef, useState } from 'react'
import type { Condition } from './api'

/** Calls `load` now and every `intervalMs` after the previous call settles. */
export function usePolling<T>(load: () => Promise<T>, intervalMs: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generation, setGeneration] = useState(0)
  const loadRef = useRef(load)

  useEffect(() => {
    loadRef.current = load
  }, [load])

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      try {
        const next = await loadRef.current()
        if (!cancelled) {
          setData(next)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      } finally {
        if (!cancelled) timer = setTimeout(run, intervalMs)
      }
    }
    run()

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [intervalMs, generation])

  const reload = useCallback(() => setGeneration((g) => g + 1), [])
  return { data, error, reload }
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  role: 'role',
  resource: 'resource',
  location: 'location',
  device_managed: 'managed device',
  device_encrypted: 'disk encrypted',
  device_patched: 'patched',
  hour: 'hour',
}

const OP_LABELS: Record<Condition['op'], string> = {
  eq: 'is',
  neq: 'is not',
  in: 'is one of',
  not_in: 'is not one of',
  gte: '≥',
  lt: '<',
}

export function describeCondition({ attribute, op, value }: Condition): string {
  let shown: string
  if (Array.isArray(value)) shown = value.join(', ')
  else if (typeof value === 'boolean') shown = value ? 'yes' : 'no'
  else if (attribute === 'hour') shown = `${String(value).padStart(2, '0')}:00`
  else shown = String(value)
  return `${ATTRIBUTE_LABELS[attribute] ?? attribute} ${OP_LABELS[op]} ${shown}`
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour12: false })
}
