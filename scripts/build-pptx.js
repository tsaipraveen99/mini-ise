/* Builds ../Mini-ISE-talk.pptx: the same eleven slides as site/src/Slides.tsx,
   for presenting offline or handing over. Diagrams are native PowerPoint
   shapes so they stay editable, and the spoken script goes in the notes pane.

   The two demo slides are static here — a .pptx cannot run the browser engine
   or animate a cluster — so each one points at its live counterpart.

   The script lives in three places and they drift silently: this file,
   the `notes` arrays in site/src/Slides.tsx, and TALK-NOTES.md. TALK-NOTES.md
   is the one to edit first.

       cd scripts && npm install && npm run build
*/
const path = require('node:path')
const pptxgen = require('pptxgenjs')

const DARK = '1B2420'
const SURFACE = 'F7F9F8'
const PANEL = 'E9EDEA'
const INK = '111A17'
const GREY = '56625D'
const SIGNAL = '2B45D9'
const SOFT = 'DDE3FB'
const HAIR = 'C9D2CD'
const ALLOW = '15804F'
const ALLOW_BG = 'D4ECDD'
const QUAR = 'A8680A'
const QUAR_BG = 'F5E6C6'
const DENY = 'C0392B'
const DENY_BG = 'F5D9D4'
const DIM = '9AA8A1'

const HEAD = 'Arial'
const BODY = 'Calibri'
const MONO = 'Courier New'

const pres = new pptxgen()
pres.layout = 'LAYOUT_WIDE' // 13.3 x 7.5
pres.author = 'Sai Praveen Tatiparthi'
pres.title = 'Mini ISE'

// `w` narrows the title so it does not run under a badge in the top-right.
const title = (slide, text, w = 11.7) =>
  slide.addText(text, {
    x: 0.8, y: 0.42, w, h: 0.8,
    fontFace: HEAD, fontSize: 32, bold: true, color: INK, isTextBox: true, margin: 0,
  })

// Width is clamped so a label placed on the right half keeps its box on the slide.
const eyebrow = (slide, text, x, y, color = GREY, w) =>
  slide.addText(text, {
    x, y, w: w ?? Math.min(6, 13.333 - x - 0.5), h: 0.28,
    fontFace: MONO, fontSize: 10, color, charSpacing: 1, isTextBox: true, margin: 0,
  })

const bullets = (slide, items, opts) =>
  slide.addText(
    items.map((t, i) => ({
      text: t,
      options: { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 10 },
    })),
    { fontFace: BODY, fontSize: 15, color: INK, isTextBox: true, margin: 0, ...opts },
  )

/** Labelled box used in the architecture diagram. */
function node(slide, { x, y, w, h, name, sub, accent = false }) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.06,
    fill: { color: accent ? SOFT : SURFACE },
    line: { color: accent ? SIGNAL : HAIR, width: accent ? 1.5 : 1 },
  })
  slide.addText(name, {
    x, y: y + 0.13, w, h: 0.35,
    fontFace: HEAD, fontSize: 15, bold: true, color: INK, align: 'center', isTextBox: true, margin: 0,
  })
  slide.addText(sub, {
    x, y: y + 0.5, w, h: 0.25,
    fontFace: MONO, fontSize: 9, color: GREY, align: 'center', isTextBox: true, margin: 0,
  })
}

function arrow(slide, { x, y, w, h, color = GREY, width = 1.5, flipV = false }) {
  slide.addShape(pres.ShapeType.line, {
    x, y, w, h, flipV,
    line: { color, width, endArrowType: 'triangle' },
  })
}

function pod(slide, { x, y, w = 1.3, h = 0.66, isNew = false }) {
  slide.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.1,
    fill: isNew ? { color: SURFACE } : { color: SOFT },
    line: { color: SIGNAL, width: 1.25, dashType: isNew ? 'dash' : 'solid' },
  })
  slide.addText('pod', {
    x, y: y + h / 2 - 0.16, w, h: 0.32,
    fontFace: MONO, fontSize: 11, color: isNew ? SIGNAL : INK, align: 'center', isTextBox: true, margin: 0,
  })
}

/** Three short lines under a diagram — the points the drawing does not say. */
function points(slide, items) {
  const w = 3.7
  items.forEach((text, i) => {
    const x = 0.8 + i * (w + 0.3)
    slide.addShape(pres.ShapeType.line, { x, y: 6.42, w, h: 0, line: { color: HAIR, width: 1 } })
    slide.addText(text, {
      x, y: 6.52, w, h: 0.45,
      fontFace: BODY, fontSize: 13, color: GREY, isTextBox: true, margin: 0,
    })
  })
}

/* ---------- 1. Title ---------- */
{
  const s = pres.addSlide()
  s.background = { color: DARK }
  s.addText('ZERO-TRUST NETWORK ACCESS, BUILT SMALL', {
    x: 0.85, y: 2.15, w: 8, h: 0.3,
    fontFace: MONO, fontSize: 11, color: DIM, charSpacing: 1, isTextBox: true, margin: 0,
  })
  s.addText('MINI ISE', {
    x: 0.8, y: 2.5, w: 9, h: 1.5,
    fontFace: HEAD, fontSize: 80, bold: true, color: 'FFFFFF', isTextBox: true, margin: 0,
  })
  s.addText('Who gets on the network, and why.', {
    x: 0.85, y: 4.05, w: 8, h: 0.5,
    fontFace: BODY, fontSize: 22, color: PANEL, isTextBox: true, margin: 0,
  })
  s.addText('Sai Praveen Tatiparthi', {
    x: 0.85, y: 5.0, w: 8, h: 0.35,
    fontFace: MONO, fontSize: 11, color: DIM, isTextBox: true, margin: 0,
  })
  // Motif: the pods that show up again on slide 6.
  for (let i = 0; i < 3; i++) {
    s.addShape(pres.ShapeType.roundRect, {
      x: 10.6, y: 2.6 + i * 0.95, w: 1.9, h: 0.72, rectRadius: 0.1,
      fill: { color: DARK }, line: { color: SIGNAL, width: 1.5 },
    })
  }
  s.addNotes(
    'Hi, I’m Sai. For the next five minutes I want to show you something I built called Mini ISE — a small version of the software that decides which laptops and phones are allowed onto a company network.\n\n' +
    'I’ll explain what it does, why scaling matters for something like this, and then how it actually scales using Kubernetes.',
  )
}

/* ---------- 2. Up or out ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'Up, or out')

  const facts = (x, lines) =>
    lines.forEach((line, i) =>
      s.addText(line, {
        x, y: 4.18 + i * 0.32, w: 5.1, h: 0.3,
        fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
      }),
    )

  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: 1.4, w: 5.6, h: 3.9, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'UP · VERTICAL', 1.05, 1.62, INK)
  s.addText('one machine, more cores', {
    x: 1.05, y: 1.92, w: 5.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  ;[
    { x: 1.15, y: 3.3, w: 0.85, h: 0.7, label: '4' },
    { x: 2.25, y: 2.85, w: 1.2, h: 1.15, label: '16' },
    { x: 3.7, y: 2.3, w: 1.7, h: 1.7, label: '64' },
  ].forEach((b) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: b.x, y: b.y, w: b.w, h: b.h, rectRadius: 0.06,
      fill: { color: PANEL }, line: { color: GREY, width: 1.25 },
    })
    s.addText(b.label, {
      x: b.x, y: b.y + b.h / 2 - 0.16, w: b.w, h: 0.32,
      fontFace: MONO, fontSize: 11, color: INK, align: 'center', isTextBox: true, margin: 0,
    })
  })
  facts(1.15, ['ceiling: the biggest box you can rent', 'failure: all of it, at once', 'complexity: almost none'])

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.9, y: 1.4, w: 5.6, h: 3.9, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'OUT · HORIZONTAL', 7.15, 1.62, SIGNAL)
  s.addText('many machines, identical', {
    x: 7.15, y: 1.92, w: 5.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  ;[0, 1, 2].forEach((col) =>
    [0, 1].forEach((row) =>
      s.addShape(pres.ShapeType.roundRect, {
        x: 7.2 + col * 1.65, y: 2.6 + row * 0.8, w: 1.5, h: 0.62, rectRadius: 0.06,
        fill: { color: SOFT }, line: { color: SIGNAL, width: 1.25 },
      }),
    ),
  )
  facts(7.2, ['ceiling: your own design', 'failure: one slice of it', 'complexity: real, and permanent'])

  points(s, ['Up: no code changes, hard ceiling', 'Out: no ceiling, real complexity', 'Go up first. It is usually enough.'])

  s.addNotes(
    'Before I show you anything I built, I want to set up the one idea the whole project rests on.\n\n' +
    'Every service that gets used hits the same wall eventually: more requests arriving than one machine can answer. And when you need more capacity, there are only two moves.\n\n' +
    'Up — vertical scaling. Buy a bigger machine. More cores, more memory. The big advantage is that your code doesn’t change at all; it’s close to a config line. The disadvantages are that there’s a hard ceiling — there is a biggest machine you can rent — it gets expensive quickly at the top end, and it’s still one machine. When it dies, all of it dies.\n\n' +
    'Out — horizontal scaling. Buy more machines. There’s no real ceiling, the cost per unit is lower, and losing one costs you a fraction of your capacity instead of all of it. The price is complexity: now you need a load balancer, you need to cope with machines appearing and disappearing, and your application has to stop caring which machine it lands on.\n\n' +
    'And the honest advice that most companies actually follow is: go up first. It’s simpler, and it’s usually enough for longer than people expect. Go out when you hit the ceiling, or when one machine being one outage stops being acceptable.',
  )
}

/* ---------- 3. State decides ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'State decides which one you can do')

  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: 1.4, w: 5.6, h: 3.9, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'STATELESS', 1.05, 1.62, SIGNAL)
  s.addShape(pres.ShapeType.roundRect, {
    x: 2.5, y: 2.05, w: 2.1, h: 0.5, rectRadius: 0.06,
    fill: { color: PANEL }, line: { color: GREY, width: 1.25 },
  })
  s.addText('balancer', {
    x: 2.5, y: 2.18, w: 2.1, h: 0.28,
    fontFace: MONO, fontSize: 11, color: INK, align: 'center', isTextBox: true, margin: 0,
  })
  ;[1.05, 2.75, 4.45].forEach((x) => {
    const cx = x + 0.75
    arrow(s, {
      x: Math.min(3.55, cx), y: 2.58, w: Math.abs(cx - 3.55), h: 0.38,
      flipV: false,
    })
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 3.0, w: 1.5, h: 0.7, rectRadius: 0.06,
      fill: { color: SOFT }, line: { color: SIGNAL, width: 1.25 },
    })
  })
  s.addText('Any box can answer.', {
    x: 1.05, y: 3.95, w: 5.0, h: 0.4,
    fontFace: BODY, fontSize: 15, color: INK, isTextBox: true, margin: 0,
  })
  s.addText('start another, point traffic at it', {
    x: 1.05, y: 4.35, w: 5.0, h: 0.35,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  s.addShape(pres.ShapeType.roundRect, {
    x: 6.9, y: 1.4, w: 5.6, h: 3.9, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'STATEFUL', 7.15, 1.62, INK)
  s.addText('needs row B', {
    x: 8.65, y: 2.12, w: 2.0, h: 0.32,
    fontFace: MONO, fontSize: 11, color: SIGNAL, align: 'center', isTextBox: true, margin: 0,
  })
  arrow(s, { x: 9.65, y: 2.5, w: 0, h: 0.42, color: SIGNAL, width: 2.5 })
  ;[
    { x: 7.15, label: 'A', hot: false },
    { x: 8.9, label: 'B', hot: true },
    { x: 10.65, label: 'C', hot: false },
  ].forEach((b) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: b.x, y: 3.0, w: 1.5, h: 0.7, rectRadius: 0.06,
      fill: { color: b.hot ? SOFT : PANEL },
      line: { color: b.hot ? SIGNAL : HAIR, width: b.hot ? 1.5 : 1 },
    })
    s.addText(b.label, {
      x: b.x, y: 3.18, w: 1.5, h: 0.35,
      fontFace: MONO, fontSize: 13, color: b.hot ? INK : GREY, align: 'center', isTextBox: true, margin: 0,
    })
  })
  s.addText('The request must find its data.', {
    x: 7.15, y: 3.95, w: 5.0, h: 0.4,
    fontFace: BODY, fontSize: 15, color: INK, isTextBox: true, margin: 0,
  })
  s.addText('replicate · shard · agree', {
    x: 7.15, y: 4.35, w: 5.0, h: 0.35,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  points(s, ['Stateless: start a copy, done', 'Stateful: replicate, shard, agree', 'So push state out of what you scale'])

  s.addNotes(
    'Except you don’t always get to choose. And the thing that decides it is state — whether a machine remembers anything between requests.\n\n' +
    'If your service is stateless, any machine can answer any request. Adding capacity is nearly trivial: start another copy, point the load balancer at it, done. Web servers and API servers are usually like this.\n\n' +
    'If it’s stateful, it’s a completely different problem. A specific piece of data lives on a specific machine, and the request has to find it. That’s where the hard techniques come in — replication, so there’s more than one copy; sharding, so the data is split by key; and consensus, so the copies agree on what’s actually true.\n\n' +
    'Databases are the classic stateful thing, and this is exactly why scaling a database is a genuinely hard problem while scaling a web tier is mostly a config change.\n\n' +
    'So the real design move — the one that matters — is to push state out of the things you want to scale, and concentrate it in as few places as you can.',
  )
}

/* ---------- 4. What it is ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'Mini ISE, in four pieces')

  s.addText('Who gets onto a company network — answered in under a millisecond.', {
    x: 0.8, y: 1.3, w: 11.7, h: 0.45,
    fontFace: BODY, fontSize: 18, color: GREY, isTextBox: true, margin: 0,
  })

  const pieces = [
    ['decision-service', 'Answers allow, deny or quarantine. The one under load.', true],
    ['policy-api', 'Where the rules live, and where Claude drafts them.', false],
    ['console', 'React. Admins write rules and watch decisions land.', false],
    ['simulator', 'Fake devices, so there is traffic to watch.', false],
  ]
  pieces.forEach(([name, line, hot], i) => {
    const x = 0.8 + (i % 2) * 6.1
    const y = 2.0 + Math.floor(i / 2) * 1.75
    s.addShape(pres.ShapeType.roundRect, {
      x, y, w: 5.6, h: 1.5, rectRadius: 0.1,
      fill: { color: hot ? SOFT : PANEL },
      line: { color: hot ? SIGNAL : HAIR, width: hot ? 1.5 : 1 },
    })
    s.addText(name, {
      x: x + 0.35, y: y + 0.24, w: 4.9, h: 0.38,
      fontFace: MONO, fontSize: 14, bold: true, color: hot ? SIGNAL : INK, isTextBox: true, margin: 0,
    })
    s.addText(line, {
      x: x + 0.35, y: y + 0.72, w: 4.9, h: 0.6,
      fontFace: BODY, fontSize: 13, color: GREY, isTextBox: true, margin: 0,
    })
  })

  s.addText('Real Python, FastAPI, Postgres and Kubernetes. The only invented part is the devices.', {
    x: 0.8, y: 5.7, w: 11.7, h: 0.4,
    fontFace: BODY, fontSize: 13, color: GREY, isTextBox: true, margin: 0,
  })

  s.addNotes(
    'So that’s the theory. Here’s the thing I built, and it has exactly that problem.\n\n' +
    'Mini ISE is a small version of the software that decides which laptops and phones are allowed onto a company network. The real ones are big enterprise products — this is the same idea, small enough that I can explain all of it.\n\n' +
    'The idea it implements is zero trust. In an old corporate network, once you were inside the building, you were trusted. Zero trust throws that out: every single request gets checked, every time, and it doesn’t matter that you checked thirty seconds ago.\n\n' +
    'Four pieces. The decision service is the one that answers — a device asks "can this user, on this laptop, from this location, reach the finance database right now", and it says allow, deny or quarantine. Always with a reason, because when someone is locked out at nine in the morning, the help desk needs to know which rule did it.\n\n' +
    'The policy API is where the rules live, and where an admin can describe a rule in plain English and have Claude draft it — a person still approves it before it goes live. The console is React: that’s where admins write rules and watch decisions arrive. And the simulator throws realistic device traffic at the whole thing so there is something to watch.\n\n' +
    'Everything there is real except the devices. Real Python, real FastAPI, real Postgres, real Kubernetes.',
  )
}

/* ---------- 5. Live: decisions (static rendition) ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'Watch it decide', 7.5)

  s.addShape(pres.ShapeType.roundRect, {
    x: 8.6, y: 0.5, w: 3.9, h: 0.45, rectRadius: 0.08,
    fill: { color: ALLOW_BG }, line: { color: ALLOW_BG, width: 0.5 },
  })
  s.addText('REAL ENGINE · SIMULATED DEVICES', {
    x: 8.6, y: 0.58, w: 3.9, h: 0.3,
    fontFace: MONO, fontSize: 9, color: ALLOW, align: 'center', charSpacing: 1, isTextBox: true, margin: 0,
  })

  const feed = [
    ['contractor · wiki · office · 18:00', 'ALLOW', ALLOW, ALLOW_BG, 'Contractor on a company-managed device'],
    ['guest · hr · remote · 20:00', 'DENY', DENY, DENY_BG, 'Guests may only access the wiki'],
    ['admin · wiki · remote · 08:00', 'QUARANTINE', QUAR, QUAR_BG, 'Device disk is not encrypted'],
    ['employee · finance · remote · 19:00', 'DENY', DENY, DENY_BG, 'Contractors cannot access finance or HR'],
  ]
  feed.forEach(([who, verdict, fg, bg, reason], i) => {
    const y = 1.6 + i * 1.02
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.8, y, w: 11.7, h: 0.85, rectRadius: 0.08,
      fill: { color: PANEL }, line: { color: HAIR, width: 1 },
    })
    s.addText(who, {
      x: 1.1, y: y + 0.27, w: 4.0, h: 0.35,
      fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
    })
    s.addShape(pres.ShapeType.roundRect, {
      x: 5.3, y: y + 0.22, w: 1.85, h: 0.42, rectRadius: 0.08,
      fill: { color: bg }, line: { color: fg, width: 1 },
    })
    s.addText(verdict, {
      x: 5.3, y: y + 0.29, w: 1.85, h: 0.3,
      fontFace: MONO, fontSize: 9, bold: true, color: fg, align: 'center', isTextBox: true, margin: 0,
    })
    s.addText(reason, {
      x: 7.4, y: y + 0.26, w: 4.8, h: 0.4,
      fontFace: BODY, fontSize: 13, color: INK, isTextBox: true, margin: 0,
    })
  })

  s.addText('This runs live in the web deck: mini-ise.vercel.app/#/slides/3', {
    x: 0.8, y: 5.95, w: 11.7, h: 0.4,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  s.addNotes(
    'Let me show you it actually working. These requests are invented — I’m generating fake devices — but the thing deciding is the real engine. It’s the same rule code the pods run, compiled to the browser, and it’s tested against the same set of cases in CI, so the two can’t quietly disagree.\n\n' +
    'Watch the reasons rather than the verdicts. Every answer names the rule that produced it.\n\n' +
    'And there’s the third verdict — quarantine. That’s not "we think you’re hacked". That’s a device that failed a posture check, usually an unencrypted disk. It gets a restricted segment where it can reach the tool that fixes it, and nothing else.\n\n' +
    '(In the web deck: press Start traffic, let four or five rows run, then pause.)',
  )
}

/* ---------- 6. Architecture ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'How it’s put together')

  eyebrow(s, 'ADMIN PATH · A FEW PEOPLE', 0.8, 1.45)
  node(s, { x: 0.8, y: 1.78, w: 2.6, h: 0.95, name: 'Console', sub: 'React + TS' })
  node(s, { x: 4.5, y: 1.78, w: 2.8, h: 0.95, name: 'policy-api', sub: 'FastAPI' })
  arrow(s, { x: 3.45, y: 2.26, w: 1.0, h: 0 })
  arrow(s, { x: 7.35, y: 2.26, w: 1.75, h: 0.85 })

  node(s, { x: 9.2, y: 2.95, w: 3.1, h: 1.0, name: 'Postgres', sub: 'policies + log' })

  eyebrow(s, 'HOT PATH · THOUSANDS PER SECOND', 0.8, 4.25, SIGNAL)
  node(s, { x: 0.8, y: 4.58, w: 2.6, h: 0.95, name: 'Simulator', sub: 'fake devices' })
  // Offset edges behind the box imply more than one pod.
  s.addShape(pres.ShapeType.roundRect, {
    x: 4.66, y: 4.42, w: 2.8, h: 0.95, rectRadius: 0.06,
    fill: { color: SURFACE }, line: { color: HAIR, width: 1 },
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 4.58, y: 4.5, w: 2.8, h: 0.95, rectRadius: 0.06,
    fill: { color: SURFACE }, line: { color: HAIR, width: 1 },
  })
  node(s, { x: 4.5, y: 4.58, w: 2.8, h: 0.95, name: 'decision-service', sub: 'FastAPI · N pods', accent: true })
  arrow(s, { x: 3.45, y: 5.06, w: 1.0, h: 0, color: SIGNAL, width: 2 })
  s.addText('requests', {
    x: 3.35, y: 4.74, w: 1.2, h: 0.28,
    fontFace: MONO, fontSize: 9, color: SIGNAL, align: 'center', isTextBox: true, margin: 0,
  })
  arrow(s, { x: 7.46, y: 3.95, w: 1.64, h: 0.95, flipV: true })
  s.addText('policies in every 3s\nlogs out in batches', {
    x: 8.9, y: 4.5, w: 3.5, h: 0.6,
    fontFace: MONO, fontSize: 10, color: GREY, align: 'right', isTextBox: true, margin: 0,
  })

  points(s, ['React + TypeScript console', 'Python + FastAPI services', 'Two services, different blast radius'])

  s.addNotes(
    'Here’s the architecture. Top row: the React console, TypeScript, that’s where admins live. It talks to a policy API written in Python with FastAPI, which reads and writes policies in Postgres.\n\n' +
    'Bottom row, completely separate: the decision service. Also Python, also FastAPI. That’s the one answering access requests. I’ve got a simulator throwing realistic device traffic at it so there’s something to watch.\n\n' +
    'The important thing is that those are two separate services, and that was deliberate. The policy API is used by a handful of admins clicking buttons. The decision service answers thousands of requests a second. They have nothing in common in terms of load, so they shouldn’t share a fate — if an admin runs an expensive report, it should not slow down the front door. That’s what people mean by blast radius — how much of the system goes down when one part of it does.',
  )
}

/* ---------- 7. The API surface ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'Two services, eight endpoints')

  const cols = [
    {
      x: 0.8, name: 'decision-service', hot: true,
      rows: [['POST', '/v1/decide', true], ['GET', '/healthz — am I alive?', false],
             ['GET', '/readyz — should I get traffic?', false]],
      foot: 'One endpoint carries all the load.',
    },
    {
      x: 6.9, name: 'policy-api', hot: false,
      rows: [['GET', '/v1/policies', false], ['POST', '/v1/policies', false],
             ['PATCH', '/v1/policies/{id}', false], ['DELETE', '/v1/policies/{id}', false],
             ['POST', '/v1/policies/draft — Claude drafts', false],
             ['GET', '/v1/decisions', false], ['GET', '/v1/stats', false]],
      foot: 'Everything else is admin work for a handful of people.',
    },
  ]
  cols.forEach((col) => {
    s.addShape(pres.ShapeType.roundRect, {
      x: col.x, y: 1.5, w: 5.6, h: 4.3, rectRadius: 0.1,
      fill: { color: col.hot ? SOFT : PANEL },
      line: { color: col.hot ? SIGNAL : HAIR, width: col.hot ? 1.5 : 1 },
    })
    s.addText(col.name, {
      x: col.x + 0.4, y: 1.75, w: 4.8, h: 0.45,
      fontFace: HEAD, fontSize: 21, bold: true, color: INK, isTextBox: true, margin: 0,
    })
    col.rows.forEach(([method, path, load], i) => {
      const y = 2.35 + i * 0.36
      s.addText(method, {
        x: col.x + 0.4, y, w: 0.95, h: 0.3,
        fontFace: MONO, fontSize: 10, bold: !!load,
        color: load ? SIGNAL : GREY, isTextBox: true, margin: 0,
      })
      s.addText(path, {
        x: col.x + 1.4, y, w: 4.0, h: 0.3,
        fontFace: MONO, fontSize: 10, bold: !!load,
        color: load ? SIGNAL : INK, isTextBox: true, margin: 0,
      })
    })
    s.addText(col.foot, {
      x: col.x + 0.4, y: 5.2, w: 4.8, h: 0.45,
      fontFace: BODY, fontSize: 12, color: GREY, isTextBox: true, margin: 0,
    })
  })

  s.addNotes(
    'Let me show you the actual API, because the shape of it is the design.\n\n' +
    'The decision service has one endpoint that matters: POST /v1/decide. That’s it. That is the entire hot path — a device asks, it answers.\n\n' +
    'The other two are health checks, and they are not the same question. Healthz means "am I alive" — if that fails, Kubernetes restarts the pod. Readyz means "should I be getting traffic" — if that fails, Kubernetes simply stops sending it any. That second one is the readiness gate, and it’s what stops a brand new pod answering before its policies have loaded.\n\n' +
    'The policy API has everything else: create, read, update and delete policies, the drafting endpoint where Claude turns plain English into a policy for a person to approve, the decision log, and the stats the console charts.\n\n' +
    'And that split is the whole point. One endpoint carries all the load. Seven do admin work for a handful of people. Which is exactly why one of these services runs six pods and the other runs one.',
  )
}

/* ---------- 8. One request ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'What one request actually touches')

  eyebrow(s, 'HOT PATH', 0.8, 1.35, SIGNAL, 2.0)
  s.addText('POST /v1/decide', {
    x: 4.4, y: 1.3, w: 3.4, h: 0.32,
    fontFace: MONO, fontSize: 11, color: SIGNAL, align: 'center', isTextBox: true, margin: 0,
  })

  node(s, { x: 0.8, y: 1.75, w: 2.6, h: 0.95, name: 'device', sub: 'asks' })
  arrow(s, { x: 3.5, y: 2.22, w: 0.75, h: 0, color: SIGNAL, width: 2.5 })
  node(s, { x: 4.35, y: 1.72, w: 3.5, h: 1.0, name: 'evaluate the rules', sub: 'in memory', accent: true })
  arrow(s, { x: 7.95, y: 2.22, w: 0.75, h: 0, color: SIGNAL, width: 2.5 })
  node(s, { x: 8.8, y: 1.75, w: 3.7, h: 0.95, name: 'allow · deny · quarantine', sub: 'and the reason' })

  s.addText('Under 1 ms — no database, no cache, no other service.', {
    x: 3.3, y: 2.9, w: 9.2, h: 0.4,
    fontFace: HEAD, fontSize: 17, bold: true, color: INK, isTextBox: true, margin: 0,
  })

  node(s, { x: 4.35, y: 4.45, w: 2.9, h: 0.95, name: 'Postgres', sub: 'policies + log' })
  s.addShape(pres.ShapeType.line, {
    x: 4.9, y: 2.78, w: 0, h: 1.62,
    line: { color: GREY, width: 1.75, dashType: 'dash', endArrowType: 'triangle' },
    flipV: true,
  })
  s.addText('policies in · every 3s', {
    x: 5.05, y: 3.5, w: 3.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  s.addShape(pres.ShapeType.line, {
    x: 7.3, y: 2.78, w: 3.0, h: 1.62,
    line: { color: GREY, width: 1.75, dashType: 'dash', endArrowType: 'triangle' },
    flipH: true, flipV: true,
  })
  s.addText('log out · in batches', {
    x: 8.5, y: 3.62, w: 3.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  s.addText('Dashed = beside the request, not inside it.', {
    x: 0.8, y: 5.65, w: 11.7, h: 0.35,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  s.addNotes(
    'So what actually happens inside that one endpoint.\n\n' +
    'A request comes in. The service evaluates the rules against it — in memory, in Python — and returns allow, deny or quarantine, with the reason. That is the whole path. Under a millisecond. And notice what is not on it: no database call, no cache lookup, no call to another service.\n\n' +
    'Everything that does touch the database is off to the side, and I’ve drawn it dashed. Policies come in on a background task every three seconds. Decision logs go out buffered, in batches.\n\n' +
    'That is the only really clever thing in this project: the slow thing and the fast thing were separated, so the fast thing stays fast even when the slow thing is broken.',
  )
}

/* ---------- 9. Holds no state ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'The decision service holds no state.')

  bullets(s, [
    'Policies live in memory, refreshed every 3 seconds',
    'A decision touches no network — zero database calls on the hot path',
    'Logs are buffered and written in batches, capped at 10,000 rows',
    'Postgres dies, it keeps deciding. No policies yet, it denies.',
    'No pod holds anything unique, so any pod can answer any request',
  ], { x: 0.8, y: 1.6, w: 6.6, h: 3.6, fontSize: 16 })

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 1.6, w: 4.6, h: 3.1, rectRadius: 0.1,
    fill: { color: SOFT }, line: { color: SIGNAL, width: 1.5 },
  })
  s.addText('ONE POD', {
    x: 7.9, y: 1.82, w: 4.6, h: 0.3,
    fontFace: MONO, fontSize: 10, color: SIGNAL, align: 'center', charSpacing: 1, isTextBox: true, margin: 0,
  })
  s.addText('policies in memory', {
    x: 7.9, y: 2.15, w: 4.6, h: 0.4,
    fontFace: HEAD, fontSize: 17, bold: true, color: INK, align: 'center', isTextBox: true, margin: 0,
  })
  s.addText('< 1 ms', {
    x: 7.9, y: 2.7, w: 4.6, h: 1.0,
    fontFace: HEAD, fontSize: 52, bold: true, color: SIGNAL, align: 'center', isTextBox: true, margin: 0,
  })
  s.addText('no network on the hot path', {
    x: 7.9, y: 3.95, w: 4.6, h: 0.4,
    fontFace: BODY, fontSize: 13, color: GREY, align: 'center', isTextBox: true, margin: 0,
  })
  s.addText('logs buffered · flushed in batches · capped at 10,000 rows', {
    x: 7.9, y: 4.85, w: 4.6, h: 0.5,
    fontFace: MONO, fontSize: 9, color: GREY, align: 'center', isTextBox: true, margin: 0,
  })

  s.addNotes(
    'And this is the design choice the whole thing rests on.\n\n' +
    'The policies live in memory, inside each pod. A background task refreshes them every three seconds. So when a request arrives, answering it touches no network at all — no database call, no cache lookup. It’s just Python evaluating rules against a request in memory. That’s how it stays under a millisecond.\n\n' +
    'The decision log still has to be written, obviously. But those rows get buffered and written to Postgres in batches, off the hot path. And the buffer is capped at ten thousand rows, so if the database goes away for an hour, the service doesn’t eat all its memory and fall over.\n\n' +
    'Two failure behaviours I want to call out, because I think they’re the interesting part. If Postgres disappears, the service keeps deciding, using the last policies it loaded. It degrades — it doesn’t stop. And if a pod hasn’t loaded its policies yet, it denies everything. It fails closed. In security, failing open is how you end up in the news.\n\n' +
    'The payoff: because no pod holds anything unique, any pod can answer any request. That’s the stateless property from the start of the talk. Which means I can just add pods.',
  )
}

/* ---------- 10. How it scales ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'So Kubernetes just adds pods')

  // Request volume climbing, as a ramp of bars.
  eyebrow(s, 'REQUESTS PER SECOND', 0.8, 1.32, SIGNAL)
  const BARS = 12
  const baseline = 2.72
  for (let i = 0; i < BARS; i++) {
    const h = 0.14 + (i / (BARS - 1)) * 0.78
    s.addShape(pres.ShapeType.roundRect, {
      x: 0.8 + i * 0.98, y: baseline - h, w: 0.7, h, rectRadius: 0.04,
      fill: { color: SOFT }, line: { color: SIGNAL, width: 0.75 },
    })
  }

  s.addShape(pres.ShapeType.roundRect, {
    x: 0.8, y: 3.05, w: 5.0, h: 2.95, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'NORMAL · 2 PODS', 1.05, 3.28)
  pod(s, { x: 1.05, y: 3.68, w: 1.9, h: 0.8 })
  pod(s, { x: 3.15, y: 3.68, w: 1.9, h: 0.8 })
  s.addText('CPU below target. Nothing happens.', {
    x: 1.05, y: 5.35, w: 4.5, h: 0.4,
    fontFace: BODY, fontSize: 13, color: GREY, isTextBox: true, margin: 0,
  })

  arrow(s, { x: 6.1, y: 4.5, w: 1.1, h: 0, color: SIGNAL, width: 4 })
  s.addText('HPA', {
    x: 5.85, y: 4.05, w: 1.6, h: 0.35,
    fontFace: HEAD, fontSize: 14, bold: true, color: INK, align: 'center', isTextBox: true, margin: 0,
  })
  s.addText('CPU > target', {
    x: 5.75, y: 4.72, w: 1.8, h: 0.3,
    fontFace: MONO, fontSize: 9, color: SIGNAL, align: 'center', isTextBox: true, margin: 0,
  })

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.5, y: 3.05, w: 5.0, h: 2.95, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  eyebrow(s, 'HIGH · 6 PODS', 7.75, 3.28, SIGNAL)
  const cols = [7.75, 9.32, 10.89]
  cols.forEach((x, i) => {
    pod(s, { x, y: 3.68, w: 1.42, h: 0.72, isNew: i > 0 })
    pod(s, { x, y: 4.55, w: 1.42, h: 0.72, isNew: i > 0 })
  })
  s.addText('Dashed pods are new. Each waits for readiness.', {
    x: 7.75, y: 5.35, w: 4.6, h: 0.4,
    fontFace: BODY, fontSize: 13, color: GREY, isTextBox: true, margin: 0,
  })

  points(s, ['Autoscaler: 2 to 6 pods on CPU', 'Readiness before any traffic', 'Self-healing: pods replace themselves'])

  s.addNotes(
    'And that’s exactly what Kubernetes does. Follow the diagram left to right. At normal load I’m running two pods of the decision service. As requests arrive faster, CPU on those pods climbs. The horizontal pod autoscaler is watching that number, and when it crosses the target, Kubernetes starts new pods — up to six. The service spreads requests across all of them. When traffic drops, it scales back in, because pods cost money.\n\n' +
    'Two details that make this actually work, rather than just look good on a slide.\n\n' +
    'First — readiness. A brand new pod is not ready the moment it starts; it has to load policies first. So there’s a readiness check, and Kubernetes won’t send it a single request until it passes. Without that, scaling up would cause a burst of denials, which is worse than being slow.\n\n' +
    'Second — self-healing. If I delete a pod right now, and it’s one command, Kubernetes notices and starts a replacement, and traffic keeps flowing the whole time because the other pods are still answering. Losing one pod costs a sixth of the capacity, not all of it.\n\n' +
    'And you can watch all of it in the console — it shows decisions per pod, live, so you literally see new pods start taking work.',
  )
}

/* ---------- 11. Live: autoscaling (static rendition) ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'Watch it scale', 6.9)

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 0.5, w: 4.6, h: 0.45, rectRadius: 0.08,
    fill: { color: QUAR_BG }, line: { color: QUAR_BG, width: 0.5 },
  })
  s.addText('SIMULATED CLUSTER — NOT A LIVE CLUSTER', {
    x: 7.9, y: 0.58, w: 4.6, h: 0.3,
    fontFace: MONO, fontSize: 9, color: QUAR, align: 'center', charSpacing: 1, isTextBox: true, margin: 0,
  })

  s.addText('236', {
    x: 0.8, y: 1.6, w: 2.4, h: 1.0,
    fontFace: HEAD, fontSize: 54, bold: true, color: SIGNAL, isTextBox: true, margin: 0,
  })
  s.addText('requests / sec', {
    x: 0.85, y: 2.6, w: 2.4, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 3.6, y: 1.95, w: 6.0, h: 0.34, rectRadius: 0.17,
    fill: { color: HAIR }, line: { color: HAIR, width: 0.5 },
  })
  s.addShape(pres.ShapeType.roundRect, {
    x: 3.6, y: 1.95, w: 4.08, h: 0.34, rectRadius: 0.17,
    fill: { color: SIGNAL }, line: { color: SIGNAL, width: 0.5 },
  })
  s.addText('CPU 68% · target 70%', {
    x: 3.6, y: 2.4, w: 6.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })
  s.addText('6', {
    x: 10.4, y: 1.6, w: 2.1, h: 1.0,
    fontFace: HEAD, fontSize: 54, bold: true, color: SIGNAL, isTextBox: true, margin: 0,
  })
  s.addText('pods (min 2, max 6)', {
    x: 10.45, y: 2.6, w: 2.1, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  const tiles = [
    ['pod-01', '252 decisions', false],
    ['pod-02', '252 decisions', false],
    ['pod-03', '95 decisions', false],
    ['pod-04', '52 decisions', false],
    ['pod-05', '23 decisions', false],
    ['pod-06', 'loading policies…', true],
  ]
  tiles.forEach(([name, state, waiting], i) => {
    const x = 0.8 + i * 1.97
    s.addShape(pres.ShapeType.roundRect, {
      x, y: 3.3, w: 1.8, h: 1.15, rectRadius: 0.1,
      fill: waiting ? { color: SURFACE } : { color: SOFT },
      line: { color: SIGNAL, width: 1.25, dashType: waiting ? 'dash' : 'solid' },
    })
    s.addText(name, {
      x: x + 0.18, y: 3.5, w: 1.5, h: 0.3,
      fontFace: MONO, fontSize: 10, bold: true, color: INK, isTextBox: true, margin: 0,
    })
    s.addText(state, {
      x: x + 0.18, y: 3.82, w: 1.5, h: 0.45,
      fontFace: MONO, fontSize: 8, color: GREY, isTextBox: true, margin: 0,
    })
  })

  s.addText('Kill a pod and a replacement appears — and waits for readiness before it takes traffic.', {
    x: 0.8, y: 4.9, w: 11.7, h: 0.4,
    fontFace: HEAD, fontSize: 17, bold: true, color: INK, isTextBox: true, margin: 0,
  })
  s.addText('This runs live in the web deck: mini-ise.vercel.app/#/slides/13', {
    x: 0.8, y: 5.95, w: 11.7, h: 0.4,
    fontFace: MONO, fontSize: 10, color: GREY, isTextBox: true, margin: 0,
  })

  s.addNotes(
    'I can’t bring a Kubernetes cluster into this room, so this is a simulation — it says so on the slide. The code that really does this is in the repo, and it’s one make command.\n\n' +
    'Here we are at normal load: two pods, CPU comfortable. Now I’ll turn the load up — that’s make load-high.\n\n' +
    'CPU crosses the target, and the autoscaler starts pods. Notice the new ones come up dashed — they are not taking traffic yet, because they still have to load their policies and pass the readiness check. That’s the detail that stops a scale-up causing a burst of denials.\n\n' +
    'And now let me kill one. Kubernetes notices immediately and starts a replacement, which also has to pass readiness before it gets traffic. The decision count on the other pods never stops climbing — losing one costs a sixth of the capacity, not all of it.\n\n' +
    '(In the web deck: Start, then Load: high, wait for six pods, then Kill a pod.)',
  )
}

/* ---------- 12. What doesn't scale out ---------- */
{
  const s = pres.addSlide()
  s.background = { color: SURFACE }
  title(s, 'What doesn’t scale out — and what I’d do about it')

  bullets(s, [
    'Postgres is a single instance, and the only stateful thing here',
    'So it sits off the critical path: no reads, no writes on the hot path',
    'Database gone, devices still get on. The audit log just lags.',
    'Not sharding — splitting the data across machines. That is a last resort.',
  ], { x: 0.8, y: 1.7, w: 6.6, h: 3.2, fontSize: 16 })

  s.addShape(pres.ShapeType.roundRect, {
    x: 7.9, y: 1.6, w: 4.6, h: 3.2, rectRadius: 0.1,
    fill: { color: PANEL }, line: { color: HAIR, width: 1 },
  })
  s.addText('AT 100x TRAFFIC', {
    x: 8.2, y: 1.85, w: 4.0, h: 0.3,
    fontFace: MONO, fontSize: 10, color: GREY, charSpacing: 1, isTextBox: true, margin: 0,
  })
  ;[
    ['Queue', 'in front of the decision log'],
    ['Read replicas', 'for the console’s reporting'],
  ].forEach(([name, line], i) => {
    const y = 2.3 + i * 1.15
    s.addShape(pres.ShapeType.roundRect, {
      x: 8.2, y, w: 4.0, h: 0.95, rectRadius: 0.08,
      fill: { color: SOFT }, line: { color: SIGNAL, width: 1.25 },
    })
    s.addText(name, {
      x: 8.45, y: y + 0.14, w: 3.5, h: 0.35,
      fontFace: HEAD, fontSize: 15, bold: true, color: INK, isTextBox: true, margin: 0,
    })
    s.addText(line, {
      x: 8.45, y: y + 0.5, w: 3.5, h: 0.3,
      fontFace: BODY, fontSize: 12, color: GREY, isTextBox: true, margin: 0,
    })
  })

  s.addNotes(
    'One honest limitation, because every system has one.\n\n' +
    'Postgres here is a single instance, and it’s the only stateful thing in the system. Which makes it, technically, a single point of failure.\n\n' +
    'What I did about it is push it off the critical path entirely. Policies are cached in memory, so a decision never reads from it. Logs are batched, so a decision never writes to it. The database being slow or gone does not stop devices getting onto the network — it just means the audit log lags behind.\n\n' +
    'If traffic went up a hundred times, I’d put the decision log behind a queue, so writes get absorbed rather than buffered in process memory, and I’d add read replicas for the console’s reporting.\n\n' +
    'I would not shard it. You shard when you have run out of other options, and I haven’t.',
  )
}

/* ---------- 13. Thank you ---------- */
{
  const s = pres.addSlide()
  s.background = { color: DARK }
  s.addText('THANK YOU', {
    x: 0.85, y: 2.5, w: 9, h: 1.2,
    fontFace: HEAD, fontSize: 60, bold: true, color: 'FFFFFF', isTextBox: true, margin: 0,
  })
  s.addText('Questions?', {
    x: 0.9, y: 3.75, w: 8, h: 0.5,
    fontFace: BODY, fontSize: 22, color: PANEL, isTextBox: true, margin: 0,
  })
  s.addText('github.com/tsaipraveen99/mini-ise\nmini-ise.vercel.app', {
    x: 0.9, y: 4.6, w: 8, h: 0.8,
    fontFace: MONO, fontSize: 12, color: DIM, lineSpacing: 22, isTextBox: true, margin: 0,
  })
  for (let i = 0; i < 3; i++) {
    s.addShape(pres.ShapeType.roundRect, {
      x: 10.6, y: 2.6 + i * 0.95, w: 1.9, h: 0.72, rectRadius: 0.1,
      fill: { color: DARK }, line: { color: SIGNAL, width: 1.5 },
    })
  }
  s.addNotes(
    'That’s Mini ISE. Python and FastAPI for the two services, React and TypeScript for the console, Kubernetes for the scaling.\n\n' +
    'The code, and a page where you can try the policy engine yourself, are at these links. Happy to take questions.',
  )
}

pres.writeFile({ fileName: path.join(__dirname, '..', 'Mini-ISE-talk.pptx') }).then((f) => console.log('wrote', f))
