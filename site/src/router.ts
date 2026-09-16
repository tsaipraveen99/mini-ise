import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

export type Route = 'landing' | 'engine' | 'slides'

export function routeOf(hash: string): Route {
  if (hash.startsWith('#/engine')) return 'engine'
  if (hash.startsWith('#/slides')) return 'slides'
  return 'landing'
}

const listeners = new Set<() => void>()
let currentRoute: Route = routeOf(window.location.hash)

const notify = () => listeners.forEach((listener) => listener())

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Brings the right part of the new page into view: a section id if the hash names one, else the top. */
function settleScroll(hash: string) {
  const id = hash.startsWith('#') && !hash.startsWith('#/') ? hash.slice(1) : ''
  const target = id ? document.getElementById(id) : null
  if (target) target.scrollIntoView({ behavior: 'instant', block: 'start' })
  else window.scrollTo({ top: 0, behavior: 'instant' })
}

/** Runs a DOM update inside a view transition when the browser supports it and motion is allowed. */
function withTransition(update: () => void): Promise<void> {
  if (!('startViewTransition' in document) || prefersReducedMotion()) {
    update()
    return Promise.resolve()
  }
  return document.startViewTransition(() => flushSync(update)).finished
}

// Covers plain links, typed URLs and the back button. Only a change of page gets a transition;
// moving between sections or slides keeps its own, lighter motion.
window.addEventListener('hashchange', () => {
  const next = routeOf(window.location.hash)
  if (next === currentRoute) {
    notify()
    return
  }
  currentRoute = next
  const hash = window.location.hash
  void withTransition(() => {
    notify()
    settleScroll(hash)
  })
})

/** Navigates to a hash. Resolves when any page transition has finished. */
export function navigate(hash: string): Promise<void> {
  const next = routeOf(hash)
  if (next === currentRoute) {
    window.location.hash = hash
    return Promise.resolve()
  }
  currentRoute = next
  return withTransition(() => {
    window.history.pushState(null, '', hash)
    notify()
    settleScroll(hash)
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash)
}
