import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { PageLink } from './Chrome'
import { AUTHOR, BOOTCAMP, REPO, SITE, SLIDE_COUNT } from './content'
import {
  ArchitectureDiagram,
  AutoscaleDiagram,
  RequestFlowDiagram,
  StateDiagram,
  UpOrOutDiagram,
} from './Diagrams'
import { LiveAutoscale, LiveDecisions } from './Demos'
import { LogoMark } from './Logo'

interface Slide {
  title: string
  body: ReactNode
  /** Spoken script, one entry per paragraph. Kept close to TALK-NOTES.md at the repo root. */
  notes: string[]
}

const SLIDES: Slide[] = [
  {
    title: 'Mini ISE',
    body: (
      <div className="s-title">
        <LogoMark className="s-logo" />
        <p className="s-eyebrow">Zero-trust network access, built small</p>
        <h1 className="s-display">Mini ISE</h1>
        <p className="s-lede">Who gets on the network, and why.</p>
        <p className="s-byline">
          {AUTHOR.name}
          {BOOTCAMP && <span> · {BOOTCAMP}</span>}
        </p>
      </div>
    ),
    notes: [
      'Hi, I’m Sai. For the next ten minutes I want to show you something I built called Mini ISE — a small version of the software that decides which laptops and phones are allowed onto a company network.',
      'I’m going to do this slightly backwards. First, two slides on how you actually add capacity to a system — because there is one idea in there that decides everything else. Then I’ll show you the thing I built, and you’ll see that idea doing real work.',
    ],
  },
  {
    title: 'Up or out',
    body: (
      <div className="s-diagram-slide">
        <h2 className="s-heading s-heading--small">Up, or out</h2>
        <UpOrOutDiagram />
        <ul className="s-diagram-points">
          <li>Up: no code changes, hard ceiling</li>
          <li>Out: no ceiling, real complexity</li>
          <li>Go up first. It is usually enough.</li>
        </ul>
      </div>
    ),
    notes: [
      'Before I show you anything I built, I want to set up the one idea the whole project rests on.',
      'Every service that gets used hits the same wall eventually: more requests arriving than one machine can answer. And when you need more capacity, there are only two moves.',
      'Up — vertical scaling. Buy a bigger machine. More cores, more memory. The big advantage is that your code doesn’t change at all; it’s close to a config line. The disadvantages are that there’s a hard ceiling — there is a biggest machine you can rent — it gets expensive quickly at the top end, and it’s still one machine. When it dies, all of it dies.',
      'Out — horizontal scaling. Buy more machines. There’s no real ceiling, the cost per unit is lower, and losing one costs you a fraction of your capacity instead of all of it. The price is complexity: now you need a load balancer, you need to cope with machines appearing and disappearing, and your application has to stop caring which machine it lands on.',
      'And the honest advice that most companies actually follow is: go up first. It’s simpler, and it’s usually enough for longer than people expect. Go out when you hit the ceiling, or when one machine being one outage stops being acceptable.',
    ],
  },
  {
    title: 'State decides',
    body: (
      <div className="s-diagram-slide">
        <h2 className="s-heading s-heading--small">State decides which one you can do</h2>
        <StateDiagram />
        <ul className="s-diagram-points">
          <li>Stateless: start a copy, done</li>
          <li>Stateful: replicate, shard, agree</li>
          <li>So push state out of what you scale</li>
        </ul>
      </div>
    ),
    notes: [
      'Except you don’t always get to choose. And the thing that decides it is state — whether a machine remembers anything between requests.',
      'If your service is stateless, any machine can answer any request. Adding capacity is nearly trivial: start another copy, point the load balancer at it, done. Web servers and API servers are usually like this.',
      'If it’s stateful, it’s a completely different problem. A specific piece of data lives on a specific machine, and the request has to find it. That’s where the hard techniques come in — replication, so there’s more than one copy; sharding, so the data is split by key; and consensus, so the copies agree on what’s actually true.',
      'Databases are the classic stateful thing, and this is exactly why scaling a database is a genuinely hard problem while scaling a web tier is mostly a config change.',
      'So the real design move — the one that matters — is to push state out of the things you want to scale, and concentrate it in as few places as you can.',
    ],
  },
  {
    title: 'What it is',
    body: (
      <div>
        <h2 className="s-heading">A laptop asks. Something has to answer.</h2>
        <ul className="s-list s-list--roomy">
          <li>
            <strong>Zero trust:</strong> every request checked, every time
          </li>
          <li>A device asks for access to a resource</li>
          <li>
            A service answers <strong>allow, deny or quarantine</strong> — always with a reason
          </li>
          <li>Admins manage the rules in a React console</li>
        </ul>
      </div>
    ),
    notes: [
      'So that’s the theory. Here’s the thing I built, and it has exactly that problem.\n\nIn an old corporate network, once you were inside the building, you were trusted. Zero trust throws that out. Every single request gets checked, every time — it doesn’t matter that you checked thirty seconds ago.',
      'Mini ISE does exactly that. A device shows up and asks: can this user, on this laptop, from this location, reach the finance database right now? And a service answers one of three things — allow, deny, or quarantine — and it always gives a reason.',
      'That reason matters more than people expect. When someone gets locked out at nine in the morning, the help desk needs to know which rule did it.',
      'On the other side, admins manage those rules in a React console, and they can watch decisions stream in live.',
    ],
  },
  {
    title: 'Live: decisions',
    body: (
      <div>
        <h2 className="s-heading s-heading--small">Watch it decide</h2>
        <LiveDecisions />
      </div>
    ),
    notes: [
      'Let me show you it actually working. These requests are invented — I’m generating fake devices — but the thing deciding is the real engine. It’s the same rule code the pods run, compiled to the browser, and it’s tested against the same set of cases in CI, so the two can’t quietly disagree.',
      'Watch the reasons rather than the verdicts. Every answer names the rule that produced it.',
      'And there’s the third verdict — quarantine. That’s not "we think you’re hacked". That’s a device that failed a posture check, usually an unencrypted disk. It gets a restricted segment where it can reach the tool that fixes it, and nothing else.',
    ],
  },
  {
    title: 'Architecture',
    body: (
      <div className="s-diagram-slide">
        <h2 className="s-heading s-heading--small">How it’s put together</h2>
        <ArchitectureDiagram />
        <ul className="s-diagram-points">
          <li>React + TypeScript console</li>
          <li>Python + FastAPI services</li>
          <li>Two services, different blast radius</li>
        </ul>
      </div>
    ),
    notes: [
      'So, here’s the architecture. Top row: the React console, TypeScript, that’s where admins live. It talks to a policy API written in Python with FastAPI, which reads and writes policies in Postgres.',
      'Bottom row, completely separate: the decision service. Also Python, also FastAPI. That’s the one answering access requests. I’ve got a simulator throwing realistic device traffic at it so there’s something to watch.',
      'The important thing is that those are two separate services, and that was deliberate. The policy API is used by a handful of admins clicking buttons. The decision service answers thousands of requests a second. They have nothing in common in terms of load, so they shouldn’t share a fate — if an admin runs an expensive report, it should not slow down the front door.',
      'Different load shapes, so a problem in one never becomes a problem in the other.',
    ],
  },
  {
    title: 'The API surface',
    body: (
      <div>
        <h2 className="s-heading s-heading--small">Two services, eight endpoints</h2>
        <div className="s-api">
          <div className="is-hot">
            <h3>decision-service</h3>
            <ul>
              <li className="is-load">
                <b>POST</b>
                <span>/v1/decide</span>
              </li>
              <li>
                <b>GET</b>
                <span>/healthz — am I alive?</span>
              </li>
              <li>
                <b>GET</b>
                <span>/readyz — should I get traffic?</span>
              </li>
            </ul>
            <p>One endpoint carries all the load.</p>
          </div>
          <div>
            <h3>policy-api</h3>
            <ul>
              <li>
                <b>GET</b>
                <span>/v1/policies</span>
              </li>
              <li>
                <b>POST</b>
                <span>/v1/policies</span>
              </li>
              <li>
                <b>PATCH</b>
                <span>/v1/policies/{'{id}'}</span>
              </li>
              <li>
                <b>DELETE</b>
                <span>/v1/policies/{'{id}'}</span>
              </li>
              <li>
                <b>POST</b>
                <span>/v1/policies/draft — Claude drafts</span>
              </li>
              <li>
                <b>GET</b>
                <span>/v1/decisions</span>
              </li>
              <li>
                <b>GET</b>
                <span>/v1/stats</span>
              </li>
            </ul>
            <p>Everything else is admin work for a handful of people.</p>
          </div>
        </div>
      </div>
    ),
    notes: [
      'Let me show you the actual API, because the shape of it is the design.',
      'The decision service has one endpoint that matters: POST slash v1 slash decide. That’s it. That is the entire hot path — a device asks, it answers.',
      'The other two are health checks, and they are not the same question. Healthz means "am I alive" — if that fails, Kubernetes restarts the pod. Readyz means "should I be getting traffic" — if that fails, Kubernetes simply stops sending it any. That second one is the readiness gate, and it’s what stops a brand new pod answering before its policies have loaded.',
      'The policy API has everything else: create, read, update and delete policies, the drafting endpoint where Claude turns plain English into a policy for a person to approve, the decision log, and the stats the console charts.',
      'And that split is the whole point. One endpoint carries all the load. Seven do admin work for a handful of people. Which is exactly why one of these services runs six pods and the other runs one.',
    ],
  },
  {
    title: 'One request',
    body: (
      <div className="s-diagram-slide">
        <h2 className="s-heading s-heading--small">What one request actually touches</h2>
        <RequestFlowDiagram />
        <ul className="s-diagram-points">
          <li>Rules evaluated in memory</li>
          <li>No database call on the way through</li>
          <li>Refresh and logging sit beside it</li>
        </ul>
      </div>
    ),
    notes: [
      'So what actually happens inside that one endpoint.',
      'A request comes in. The service evaluates the rules against it — in memory, in Python — and returns allow, deny or quarantine, with the reason. That is the whole path. Under a millisecond. And notice what is not on it: no database call, no cache lookup, no call to another service.',
      'Everything that does touch the database is off to the side, and I’ve drawn it dashed. Policies come in on a background task every three seconds. Decision logs go out buffered, in batches.',
      'That is the only really clever thing in this project: the slow thing and the fast thing were separated, so the fast thing stays fast even when the slow thing is broken.',
    ],
  },
  {
    title: 'Holds no state',
    body: (
      <div>
        <h2 className="s-heading">The decision service holds no state.</h2>
        <ul className="s-list">
          <li>Policies live in memory, refreshed every 3 seconds</li>
          <li>A decision touches no network — zero database calls on the hot path</li>
          <li>Logs are buffered and written in batches, capped at 10,000 rows</li>
          <li>
            Postgres dies → it keeps deciding. No policies yet → it <strong>denies</strong>.
          </li>
          <li>
            No pod holds anything unique, so <strong>any pod can answer any request</strong>
          </li>
        </ul>
      </div>
    ),
    notes: [
      'And this is the design choice the whole thing rests on.',
      'The policies live in memory, inside each pod. A background task refreshes them every three seconds. So when a request arrives, answering it touches no network at all — no database call, no cache lookup. It’s just Python evaluating rules against a request in memory. That’s how it stays under a millisecond.',
      'The decision log still has to be written, obviously. But those rows get buffered and written to Postgres in batches, off the hot path. And the buffer is capped at ten thousand rows, so if the database goes away for an hour, the service doesn’t eat all its memory and fall over.',
      'Two failure behaviours I want to call out, because I think they’re the interesting part. If Postgres disappears, the service keeps deciding, using the last policies it loaded. It degrades — it doesn’t stop. And if a pod hasn’t loaded its policies yet, it denies everything. It fails closed. In security, failing open is how you end up in the news.',
      'The payoff: because no pod holds anything unique, any pod can answer any request. That’s the stateless property from earlier. Which means I can just add pods.',
    ],
  },
  {
    title: 'How it scales',
    body: (
      <div className="s-diagram-slide">
        <h2 className="s-heading s-heading--small">So Kubernetes just adds pods</h2>
        <AutoscaleDiagram />
        <ul className="s-diagram-points">
          <li>Autoscaler: 2 → 6 pods on CPU</li>
          <li>Readiness before any traffic</li>
          <li>Self-healing: pods replace themselves</li>
        </ul>
      </div>
    ),
    notes: [
      'And that’s exactly what Kubernetes does. Follow the diagram left to right. At normal load I’m running two pods of the decision service. As requests arrive faster, CPU on those pods climbs. The horizontal pod autoscaler is watching that number, and when it crosses the target, Kubernetes starts new pods — up to six. The service spreads requests across all of them. When traffic drops, it scales back in, because pods cost money.',
      'Two details that make this actually work, rather than just look good on a slide.',
      'First — readiness. A brand new pod is not ready the moment it starts; it has to load policies first. So there’s a readiness check, and Kubernetes won’t send it a single request until it passes. Without that, scaling up would cause a burst of denials, which is worse than being slow.',
      'Second — self-healing. If I delete a pod right now, and it’s one command, Kubernetes notices and starts a replacement, and traffic keeps flowing the whole time because the other pods are still answering. Losing one pod costs a sixth of the capacity, not all of it.',
      'And you can watch all of it in the console — it shows decisions per pod, so you literally see new pods start taking work.',
    ],
  },
  {
    title: 'Live: autoscaling',
    body: (
      <div>
        <h2 className="s-heading s-heading--small">Watch it scale</h2>
        <LiveAutoscale />
      </div>
    ),
    notes: [
      'I can’t bring a Kubernetes cluster into this room, so this is a simulation — it says so on the slide. The code that really does this is in the repo, and it’s one make command.',
      'Here we are at normal load: two pods, CPU comfortable. Now I’ll turn the load up — that’s make load-high.',
      'CPU crosses the target, and the autoscaler starts pods. Notice the new ones come up dashed — they are not taking traffic yet, because they still have to load their policies and pass the readiness check. That’s the detail that stops a scale-up causing a burst of denials.',
      'And now let me kill one. Kubernetes notices immediately and starts a replacement, which also has to pass readiness before it gets traffic. The decision count on the other pods never stops climbing — that’s the blast radius idea, live.',
    ],
  },
  {
    title: 'What doesn’t scale out',
    body: (
      <div>
        <h2 className="s-heading s-heading--small">What doesn’t scale out — and what I’d do about it</h2>
        <ul className="s-list">
          <li>Postgres is a single instance, and the only stateful thing here</li>
          <li>So it sits off the critical path: no reads on the hot path, no writes on the hot path</li>
          <li>Database gone → devices still get on. The audit log just lags.</li>
          <li>
            At 100×: a <strong>queue</strong> in front of the log, <strong>read replicas</strong> for reporting
          </li>
          <li>
            <strong>Not sharding</strong> — splitting the data across machines. That is a last resort.
          </li>
        </ul>
      </div>
    ),
    notes: [
      'One honest limitation, because every system has one.',
      'Postgres here is a single instance, and it’s the only stateful thing in the system. Which makes it, technically, a single point of failure.',
      'What I did about it is push it off the critical path entirely. Policies are cached in memory, so a decision never reads from it. Logs are batched, so a decision never writes to it. The database being slow or gone does not stop devices getting onto the network — it just means the audit log lags behind.',
      'If traffic went up a hundred times, I’d put the decision log behind a queue, so writes get absorbed rather than buffered in process memory, and I’d add read replicas for the console’s reporting.',
      'I would not shard it. You shard when you have run out of other options, and I haven’t.',
    ],
  },
  {
    title: 'Thank you',
    body: (
      <div className="s-center">
        <h2 className="s-display s-display--small">Thank you</h2>
        <p className="s-lede">Questions?</p>
        <p className="s-links">
          <span>{REPO.replace('https://', '')}</span>
          <span>{SITE.replace('https://', '')}</span>
        </p>
      </div>
    ),
    notes: [
      'That’s Mini ISE. Python and FastAPI for the two services, React and TypeScript for the console, Kubernetes for the scaling.',
      'The code, and a page where you can try the policy engine yourself, are at these links. Happy to take questions.',
    ],
  },
]

if (SLIDE_COUNT !== SLIDES.length) {
  throw new Error(`SLIDE_COUNT is ${SLIDE_COUNT} but the deck has ${SLIDES.length} slides`)
}

function parseIndex(hash: string): number {
  const n = Number(hash.split('/')[2])
  return Number.isInteger(n) && n >= 1 && n <= SLIDES.length ? n - 1 : 0
}

function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

type Direction = 'forward' | 'back' | 'none'

function SlideFrame({ slide, index, direction = 'none' }: { slide: Slide; index: number; direction?: Direction }) {
  return (
    <article className={`slide slide--enter-${direction}`} aria-label={`Slide ${index + 1}: ${slide.title}`}>
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
  const [direction, setDirection] = useState<Direction>('none')

  // Reads the slide from the URL at call time, so fast repeated key presses each advance one slide.
  const go = useCallback((target: number | ((current: number) => number)) => {
    const current = parseIndex(window.location.hash)
    const next = typeof target === 'function' ? target(current) : target
    const clamped = Math.min(Math.max(next, 0), SLIDES.length - 1)
    if (clamped === current) return
    setDirection(clamped > current ? 'forward' : 'back')
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
      <div
        className="deck-progress"
        role="progressbar"
        aria-label="Slide progress"
        aria-valuemin={1}
        aria-valuemax={SLIDES.length}
        aria-valuenow={index + 1}
      >
        <span style={{ width: `${((index + 1) / SLIDES.length) * 100}%` }} />
      </div>
      <div className="stage">
        <SlideFrame key={index} slide={slide} index={index} direction={direction} />
      </div>
      <div className="deck-bar">
        <PageLink hash="#top" className="deck-home">
          <LogoMark className="deck-logo" title="" />
          Back to the site
        </PageLink>
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
          <span className="deck-hint">← → to move · F full screen</span>
          <button type="button" onClick={() => setShowNotes((v) => !v)} aria-pressed={showNotes}>
            Notes (N)
          </button>
          <a href="#/slides/print">Print view</a>
        </div>
      </div>
      {showNotes && (
        <aside className="notes" aria-label="Speaker notes">
          {slide.notes.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </aside>
      )}
    </div>
  )
}
