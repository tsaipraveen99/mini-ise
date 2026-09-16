import { useSyncExternalStore } from 'react'

export interface SplashState {
  title: string
  detail: string
  /** Set for links that leave the site; the splash then offers "Go now" and "Stay here". */
  href?: string
  leaving?: boolean
}

let state: SplashState | null = null
const listeners = new Set<() => void>()

export const getSplash = () => state

export function setSplash(next: SplashState | null) {
  state = next
  listeners.forEach((listener) => listener())
}

export function useSplash(): SplashState | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
  )
}

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** How long the splash stays up before the page changes. */
export const splashDuration = () => (reducedMotion() ? 350 : 950)

export const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms))

/** Fades the splash out, then removes it. */
export async function closeSplash() {
  if (!state) return
  setSplash({ ...state, leaving: true })
  await wait(reducedMotion() ? 0 : 260)
  setSplash(null)
}

// Coming back with the browser's back button can restore a page with the splash still showing.
window.addEventListener('pageshow', (event) => {
  if (event.persisted) setSplash(null)
})
