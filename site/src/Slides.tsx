import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Checkpoint } from './Checkpoint'
import { AUTHOR, BOOTCAMP, REPO } from './content'

interface Slide {
  title: string
  body: ReactNode
  notes: string
}

const SLIDES: Slide[] = [
  {
    title: 'Mini ISE',
    body: (
      <div className="s-title">
        <p className="s-eyebrow">Zero-trust network access, built small</p>
        <h1 className="s-display">Mini ISE</h1>
        <p className="s-lede">Who gets on the network, and why.</p>
        <p className="s-byline">
          {AUTHOR.name}
          {BOOTCAMP && <span> · {BOOTCAMP}</span>}
        </p>
      </div>
    ),
    notes:
      'Hi, I’m Sai. For the next ten minutes: a small version of the software companies use to decide which laptops and phones get onto their network. There’s a live demo in the middle.',
  },
  {
    title: 'The old way',
    body: (
      <div className="s-split">
        <div>
          <h2 className="s-heading">The old way was a castle.</h2>
          <ul className="s-list">
            <li>Get inside the office network once</li>
            <li>Reach almost everything after that</li>
            <li>One stolen laptop can wander freely</li>
          </ul>
        </div>
        <div className="s-castle" aria-hidden="true">
          <div className="s-castle-wall">
            <span>email</span>
            <span>wiki</span>
            <span>finance</span>
            <span>hr</span>
          </div>
          <p>inside the wall = trusted</p>
        </div>
      </div>
    ),
    notes:
      'For a long time, office security worked like a castle. If your laptop was plugged into the office network, it was trusted and could reach nearly everything. The problem: if an attacker gets in once, through one laptop, they can move around freely.',
  },
  {
    title: 'Zero trust',
    body: (
      <div>
        <h2 className="s-heading">Zero trust: check every request.</h2>
        <div className="s-rules">
          <div>
            <h3>Every request, every time</h3>
            <p>Being inside the network earns nothing.</p>
          </div>
          <div>
            <h3>Decide with context</h3>
            <p>Who you are, which device, how healthy it is, where, when.</p>
          </div>
          <div>
            <h3>Least access that works</h3>
            <p>A contractor gets the wiki, not the finance servers.</p>
          </div>
        </div>
        <p className="s-footnote">It isn’t “trust nobody”. It’s “yes, but only to this, because we checked”.</p>
      </div>
    ),
    notes:
      'Zero trust replaces the castle with three rules. Check every request, not just once at the door. Decide using context: the user, their device, whether it is patched and encrypted, where they are, what time it is. And give the least access that works. People often hear zero trust as trust nobody. It is really: yes, but only to this, because we checked.',
  },
  {
    title: 'What I built',
    body: (
      <div>
        <h2 className="s-heading">A device asks. The service answers, with a reason.</h2>
        <div className="s-verdicts">
          <div className="s-verdict s-verdict--allow">
            <span>Allow</span>
            <p>Employee on a patched company laptop reaches email</p>
          </div>
          <div className="s-verdict s-verdict--quarantine">
            <span>Quarantine</span>
            <p>Laptop with an unencrypted disk gets limited access until it’s fixed</p>
          </div>
          <div className="s-verdict s-verdict--deny">
            <span>Deny</span>
            <p>Contractor on a personal laptop tries to reach finance</p>
          </div>
        </div>
      </div>
    ),
    notes:
      'So I built Mini ISE. A device asks to reach something, and the service answers one of three things: allow, quarantine, which means limited access until the device is fixed, or deny. Every answer comes with a reason, which matters when someone asks why they were blocked.',
  },
  {
    title: 'Try it',
    body: (
      <div className="s-try">
        <h2 className="s-heading s-heading--small">Try it: change the request</h2>
        <Checkpoint compact />
      </div>
    ),
    notes:
      'This is the real engine running right here in the slide. Policies are checked from the top, and the first one that matches decides. Watch: I switch to a contractor on a personal laptop at 7pm, and it walks down the list until contractors blocked from finance matches. If nothing matches at all, the answer is deny. Zero trust never lets anything in by default.',
  },
  {
    title: 'Live demo',
    body: (
      <div>
        <h2 className="s-heading">Live demo</h2>
        <ol className="s-steps">
          <li>Decisions streaming in from simulated devices</li>
          <li>Type a rule in plain English and get a drafted policy</li>
          <li>Approve it and watch decisions change</li>
          <li>Add load and watch Kubernetes add pods</li>
          <li>Delete a pod and watch it come back</li>
        </ol>
      </div>
    ),
    notes:
      'Switch to the console now. One: decisions streaming in. Two: type contractors cannot reach finance after 6pm and show the draft, including the I understood line. Three: approve it and point at new deny rows. Four: run make load-high and watch the pod count climb. Five: run make kill-decision-pod. If the network fails, use the recording.',
  },
  {
    title: 'Two paths',
    body: (
      <div>
        <h2 className="s-heading">One request, two paths</h2>
        <div className="s-paths">
          <div>
            <h3>Enforcement</h3>
            <p className="s-tag">every request · no network calls</p>
            <p className="s-chain">Device → decision service → policies in memory → verdict</p>
          </div>
          <div>
            <h3>Administration</h3>
            <p className="s-tag">a few times a week</p>
            <p className="s-chain">Admin → Claude drafts → validation → admin approves → Postgres</p>
          </div>
        </div>
      </div>
    ),
    notes:
      'Under the hood there are two separate paths. The enforcement path runs on every single request, so it makes no network calls at all: policies live in memory and refresh every few seconds. The administration path is where people write rules, a few times a week, and that is the only place the AI appears.',
  },
  {
    title: 'Where AI fits',
    body: (
      <div className="s-center">
        <p className="s-eyebrow">Where the AI fits</p>
        <p className="s-statement">
          AI drafts.
          <br />A person approves.
          <br />
          Code enforces.
        </p>
      </div>
    ),
    notes:
      'This is the one line I would like you to remember. The AI turns plain English into a draft policy. A person approves it. And plain code makes every decision.',
  },
  {
    title: 'Why the model never decides',
    body: (
      <div>
        <h2 className="s-heading">Why the model never decides</h2>
        <div className="s-rules">
          <div>
            <h3>Audits</h3>
            <p>Replay a denial and the answer must be the same. Models can answer differently each time.</p>
          </div>
          <div>
            <h3>Outages</h3>
            <p>If the AI provider is down, logins can’t stop. Enforcement calls nothing outside.</p>
          </div>
          <div>
            <h3>Injection</h3>
            <p>A device named “ignore your instructions” is just text to plain code.</p>
          </div>
        </div>
      </div>
    ),
    notes:
      'Why not let the AI decide? Three reasons. Audits: if an auditor replays last Tuesday’s denial, the answer has to be the same, and models can answer differently. Outages: if the AI provider goes down for twenty minutes at a hospital, doctors still need to log in. Injection: an attacker controls device names, and if that text reached a prompt it could become instructions.',
  },
  {
    title: 'Asking it to allow everything',
    body: (
      <div className="s-split">
        <div>
          <p className="s-eyebrow">I typed</p>
          <p className="s-quote">“Allow all the requests”</p>
          <p className="s-eyebrow">It understood</p>
          <p className="s-body">You want every access request permitted, with no conditions at all.</p>
        </div>
        <div className="s-refusal">
          <p>
            A blanket allow would match every request and override every other policy, plus the default deny. Every
            policy needs at least one condition.
          </p>
          <p className="s-eyebrow">Try one of these instead</p>
          <ul>
            <li>Allow employees and admins on managed devices</li>
            <li>Allow all roles to reach email and wiki</li>
            <li>Allow requests from the office on encrypted devices</li>
          </ul>
        </div>
      </div>
    ),
    notes:
      'While testing I asked it to allow all requests. It said what it understood, explained why that would switch off zero trust, and suggested rules that are actually safe to write. And if the model ever ignores that instruction, the same validation that checks hand-written policies still blocks the draft.',
  },
  {
    title: 'What Kubernetes adds',
    body: (
      <div>
        <h2 className="s-heading">What Kubernetes adds</h2>
        <div className="s-stats">
          <div>
            <span className="s-stat">2 → 6</span>
            <p>decision pods within 15 seconds of heavy load</p>
          </div>
          <div>
            <span className="s-stat">5 / 10k</span>
            <p>requests failed while a pod was deleted and replaced</p>
          </div>
          <div>
            <span className="s-stat">0</span>
            <p>routes from the decision service to the internet</p>
          </div>
        </div>
      </div>
    ),
    notes:
      'Kubernetes gave me three things. Scaling: under heavy load, decision pods went from two to six in about fifteen seconds. Self-healing: I deleted a pod under load and a replacement was serving within seconds; five requests out of about ten thousand failed, and I would rather show that than claim zero. And network policies: the decision service literally cannot reach the internet.',
  },
  {
    title: 'What I learned',
    body: (
      <div>
        <h2 className="s-heading">What I learned</h2>
        <ul className="s-list s-list--roomy">
          <li>Keep anything you don’t control off the critical path.</li>
          <li>Treat AI output like any other untrusted input: validate it.</li>
          <li>
            Kubernetes balances connections, not requests. New pods got no traffic until the simulator stopped
            reusing connections.
          </li>
        </ul>
      </div>
    ),
    notes:
      'Three things I learned. Anything you do not control belongs off the critical path. AI output is untrusted input and gets validated like anything else. And a surprise: Kubernetes services balance connections, not requests, so when the autoscaler added pods they got no traffic until my simulator stopped reusing connections.',
  },
  {
    title: 'Thank you',
    body: (
      <div className="s-center">
        <h2 className="s-display s-display--small">Thank you</h2>
        <p className="s-lede">Questions?</p>
        <p className="s-links">
          <span>{REPO.replace('https://', '')}</span>
          <span>{AUTHOR.portfolio.replace('https://', '')}</span>
        </p>
      </div>
    ),
    notes: 'Thanks. The code and a page where you can try the engine yourself are at these links. Happy to take questions.',
  },
]

function parseIndex(hash: string): number {
  const n = Number(hash.split('/')[2])
  return Number.isInteger(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

function SlideFrame({ slide, index }: { slide: Slide; index: number }) {
  return (
    <article className="slide" aria-label={`Slide ${index + 1}: ${slide.title}`}>
      {slide.body}
      <footer className="slide-foot">
        <span>Mini ISE</span>
        <span>
          {index + 1} / {SLIDES.length}
        </span>
      </footer>
    </article>
  )
}

export function Slides({ hash }: { hash: string }) {
  const printing = hash === '#/slides/print'
  const index = parseIndex(hash)
  const [showNotes, setShowNotes] = useState(false)

  // Reads the slide from the URL at call time, so fast repeated key presses each advance one slide.
  const go = useCallback((target: number | ((current: number) => number)) => {
    const current = parseIndex(window.location.hash)
    const next = typeof target === 'function' ? target(current) : target
    const clamped = Math.min(Math.max(next, 0), SLIDES.length - 1)
    window.location.hash = `#/slides/${clamped + 1}`
  }, [])

  useEffect(() => {
    document.title = printing ? 'Mini ISE slides' : `${SLIDES[index].title} · Mini ISE slides`
  }, [index, printing])

  useEffect(() => {
    if (printing) return
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      switch (event.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          event.preventDefault()
          go((i) => i + 1)
          break
        case 'ArrowLeft':
        case 'PageUp':
          event.preventDefault()
          go((i) => i - 1)
          break
        case 'Home':
          go(0)
          break
        case 'End':
          go(SLIDES.length - 1)
          break
        case 'n':
          setShowNotes((v) => !v)
          break
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen()
          else void document.documentElement.requestFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, printing])

  if (printing) {
    return (
      <div className="deck deck--print">
        {SLIDES.map((slide, i) => (
          <div className="stage" key={slide.title}>
            <SlideFrame slide={slide} index={i} />
          </div>
        ))}
      </div>
    )
  }

  const slide = SLIDES[index]
  return (
    <div className={`deck${showNotes ? ' deck--notes' : ''}`}>
      <div className="stage">
        <SlideFrame slide={slide} index={index} />
      </div>
      <div className="deck-bar">
        <a href="#top">Mini ISE site</a>
        <div className="deck-nav">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0}>
            Previous
          </button>
          <span aria-live="polite">
            {index + 1} / {SLIDES.length}
          </span>
          <button type="button" onClick={() => go(index + 1)} disabled={index === SLIDES.length - 1}>
            Next
          </button>
        </div>
        <div className="deck-tools">
          <button type="button" onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes}>
            Notes (N)
          </button>
          <a href="#/slides/print">Print view</a>
        </div>
      </div>
      {showNotes && (
        <aside className="notes" aria-label="Speaker notes">
          {slide.notes}
        </aside>
      )}
    </div>
  )
}
