import { useState, type MouseEvent, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { AUTHOR, REPO } from './content'
import { Logo } from './Logo'
import { navigate } from './router'

/** A link that moves to another page with a transition. Plain clicks only; modified clicks open normally. */
function useTransitionLink(hash: string) {
  const [busy, setBusy] = useState(false)
  const onClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    // Paint the busy state first so it is what fades out during the transition.
    flushSync(() => setBusy(true))
    try {
      await navigate(hash)
    } finally {
      setBusy(false)
    }
  }
  return { busy, onClick }
}

export function PageLink({ hash, className, children }: { hash: string; className?: string; children: ReactNode }) {
  const { onClick } = useTransitionLink(hash)
  return (
    <a href={hash} className={className} onClick={onClick}>
      {children}
    </a>
  )
}

export function EngineButton({ label = 'Try the policy engine' }: { label?: string }) {
  const { busy, onClick } = useTransitionLink('#/engine')
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
        <a className="nav-code" href={REPO}>
          Code
        </a>
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
        <a href={REPO}>Source on GitHub</a>
        <PageLink hash="#/slides">Talk slides</PageLink>
        {AUTHOR.linkedin && <a href={AUTHOR.linkedin}>LinkedIn</a>}
      </p>
    </footer>
  )
}
