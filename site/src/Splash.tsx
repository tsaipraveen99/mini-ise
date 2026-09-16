import type { CSSProperties } from 'react'
import { LogoMark } from './Logo'
import { closeSplash, splashDuration, useSplash } from './splashStore'

export function Splash() {
  const splash = useSplash()
  if (!splash) return null

  const style = { '--splash-ms': `${splashDuration()}ms` } as CSSProperties
  return (
    <div className={`splash${splash.leaving ? ' splash--leaving' : ''}`} style={style} role="status" aria-live="polite">
      <div className="splash-inner">
        <LogoMark className="splash-mark" title="" />
        <p className="splash-title">{splash.title}</p>
        <p className="splash-detail">{splash.detail}</p>
        <div className="splash-bar" aria-hidden="true">
          <span />
        </div>
        {splash.href && (
          <div className="splash-actions">
            <a className="button button--primary button--small" href={splash.href}>
              Go now
            </a>
            <button type="button" className="button button--quiet button--small" onClick={() => void closeSplash()}>
              Stay here
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
