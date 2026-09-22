import { useState, type MouseEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { AUTHOR, REPO, SLIDE_COUNT } from './content'
import { Logo } from './Logo'
import { navigate, routeOf } from './router'
import { closeSplash, getSplash, setSplash, splashDuration, wait } from './splashStore'

const SPLASH_COPY = {
  engine: { title: 'Opening the policy engine', detail: 'Loading the rules and live AI drafting' },
  slides: { title: 'Opening the slides', detail: `${SLIDE_COUNT} slides · use ← → to move` },
  landing: { title: 'Back to the overview', detail: 'Mini ISE' },
}

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey

/** A link to another page of the site. Shows the splash, then changes page behind it. */
function useSplashLink(hash: string) {
  const [busy, setBusy] = useState(false)
  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    const route = routeOf(hash)
    // Moving within the same page (e.g. to a section) needs no splash.
    if (route === routeOf(window.location.hash)) {
      await navigate(hash)
      return
    }
    flushSync(() => {
      setBusy(true)
      setSplash(SPLASH_COPY[route])
    })
    try {
      await wait(splashDuration())
      await navigate(hash)
    } finally {
      setBusy(false)
      await closeSplash()
    }
  }
  return { busy, onClick }
}

export function PageLink({ hash, className, children }: { hash: string; className?: string; children: ReactNode }) {
  const { onClick } = useSplashLink(hash)
  return (
    <a href={hash} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

/** A link that leaves the site. Shows where it is going, then redirects unless the visitor chooses to stay. */
export function ExternalLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(event)) return
    event.preventDefault()
    const url = new URL(href)
    const splash = {
      title: url.hostname === 'github.com' ? 'Opening GitHub' : `Opening ${url.hostname}`,
      detail: `${url.hostname}${url.pathname}`,
      href,
    }
    flushSync(() => setSplash(splash))
    await wait(splashDuration())
    // "Stay here" replaces or clears the splash, which cancels the redirect.
    if (getSplash() === splash) window.location.assign(href)
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

export function EngineButton({ label = 'Try the policy engine' }: { label?: string }) {
  const { busy, onClick } = useSplashLink('#/engine')
  return (
    <a href="#/engine" className="button button--primary" aria-busy={busy} onClick={onClick}>
      {busy ? (
        <>
          <span className="spinner" aria-hidden="true" />
          Opening the engine…
        </>
      ) : (
        <>
          {label}
          <span className="button-arrow" aria-hidden="true">
            →
          </span>
        </>
      )}
    </a>
  )
}

export function SiteHeader({ page }: { page: 'landing' | 'engine' }) {
  return (
    <header className="nav">
      <PageLink hash="#top" className="brand">
        <Logo />
      </PageLink>
      <nav aria-label="Main">
        {page === 'landing' ? (
          <>
            <a href="#how">How it works</a>
            <a href="#why">The AI’s role</a>
            <a href="#kubernetes">Kubernetes</a>
          </>
        ) : (
          <PageLink hash="#top">Overview</PageLink>
        )}
        <PageLink hash="#/engine" className={page === 'engine' ? 'is-current' : ''}>
          Engine
        </PageLink>
        <PageLink hash="#/slides">Slides</PageLink>
        <ExternalLink className="nav-code" href={REPO}>
          Code
        </ExternalLink>
      </nav>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="footer">
      <p className="footer-brand">
        <Logo />
        <span>Built by {AUTHOR.name}</span>
      </p>
      <p className="footer-links">
        <ExternalLink href={REPO}>Source on GitHub</ExternalLink>
        <PageLink hash="#/slides">Talk slides</PageLink>
        {AUTHOR.linkedin && <ExternalLink href={AUTHOR.linkedin}>LinkedIn</ExternalLink>}
      </p>
    </footer>
  )
}
