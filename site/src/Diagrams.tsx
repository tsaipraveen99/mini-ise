/* Slide diagrams.
   Drawn as inline SVG on a fixed viewBox so they scale with the slide, and
   coloured from the same tokens as the rest of the site. The .pptx version of
   the deck mirrors these two layouts with native shapes. */

const PANEL = 'var(--surface)'
const LINE = 'var(--hairline)'
const INK = 'var(--ink)'
const GREY = 'var(--graphite)'
const SIGNAL = 'var(--signal)'
const SIGNAL_SOFT = 'var(--signal-soft)'

function Arrowhead({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
      <path d="M0 0 L9 4.5 L0 9 Z" fill={color} />
    </marker>
  )
}

function Box({
  x,
  y,
  w,
  h,
  title,
  sub,
  accent = false,
}: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub: string
  accent?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="10"
        fill={accent ? SIGNAL_SOFT : PANEL}
        stroke={accent ? SIGNAL : LINE}
        strokeWidth="2"
      />
      <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" fontSize="27" fontWeight="650" fill={INK}>
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 26}
        textAnchor="middle"
        fontSize="16"
        fill={GREY}
        fontFamily="var(--mono)"
      >
        {sub}
      </text>
    </g>
  )
}

/** React console and policy API on top, the hot path underneath. */
export function ArchitectureDiagram() {
  return (
    <svg className="s-diagram" viewBox="0 0 1000 430" role="img" aria-labelledby="arch-title">
      <title id="arch-title">
        The React console talks to the policy API, which stores policies in Postgres. Separately, simulated devices
        send access requests to the decision service, which runs as several pods and also uses Postgres.
      </title>
      <defs>
        <Arrowhead id="arrow-grey" color={GREY} />
        <Arrowhead id="arrow-signal" color={SIGNAL} />
      </defs>

      {/* Admin path */}
      <text x="30" y="26" fontSize="15" fontFamily="var(--mono)" fill={GREY} letterSpacing="1">
        ADMIN PATH · A FEW PEOPLE
      </text>
      <Box x={30} y={44} w={210} h={100} title="Console" sub="React + TS" />
      <Box x={330} y={44} w={230} h={100} title="policy-api" sub="FastAPI" />
      <line x1="244" y1="94" x2="322" y2="94" stroke={GREY} strokeWidth="2.5" markerEnd="url(#arrow-grey)" />
      <line x1="564" y1="94" x2="712" y2="176" stroke={GREY} strokeWidth="2.5" markerEnd="url(#arrow-grey)" />

      {/* Shared store */}
      <Box x={720} y={162} w={220} h={106} title="Postgres" sub="policies + log" />

      {/* Hot path */}
      <text x="30" y="272" fontSize="15" fontFamily="var(--mono)" fill={SIGNAL} letterSpacing="1">
        HOT PATH · THOUSANDS PER SECOND
      </text>
      <Box x={30} y={290} w={210} h={100} title="Simulator" sub="fake devices" />
      {/* Stacked edges behind the decision service imply more than one pod. */}
      <rect x="342" y="278" width="230" height="100" rx="10" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <rect x="336" y="284" width="230" height="100" rx="10" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <Box x={330} y={290} w={230} h={100} title="decision-service" sub="FastAPI · N pods" accent />
      <line x1="244" y1="340" x2="322" y2="340" stroke={SIGNAL} strokeWidth="3" markerEnd="url(#arrow-signal)" />
      <line x1="564" y1="330" x2="712" y2="256" stroke={GREY} strokeWidth="2.5" markerEnd="url(#arrow-grey)" />

      <text x="283" y="326" textAnchor="middle" fontSize="13" fontFamily="var(--mono)" fill={SIGNAL}>
        requests
      </text>
      <text x="940" y="320" textAnchor="end" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        policies in every 3s
      </text>
      <text x="940" y="344" textAnchor="end" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        logs out in batches
      </text>
    </svg>
  )
}

function Pod({ x, y, isNew = false }: { x: number; y: number; isNew?: boolean }) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={110}
        height={62}
        rx="8"
        fill={isNew ? 'transparent' : SIGNAL_SOFT}
        stroke={SIGNAL}
        strokeWidth="2"
        strokeDasharray={isNew ? '7 5' : undefined}
        opacity={isNew ? 0.75 : 1}
      />
      <text
        x={x + 55}
        y={y + 38}
        textAnchor="middle"
        fontSize="17"
        fontFamily="var(--mono)"
        fill={isNew ? SIGNAL : INK}
      >
        pod
      </text>
    </g>
  )
}

/** Request volume rising across the top, pod count answering it underneath. */
export function AutoscaleDiagram() {
  return (
    <svg className="s-diagram" viewBox="0 0 1000 450" role="img" aria-labelledby="scale-title">
      <title id="scale-title">
        As requests per second rise, CPU crosses the autoscaler target and Kubernetes grows the decision service from
        two pods to six.
      </title>
      <defs>
        <Arrowhead id="arrow-big" color={SIGNAL} />
      </defs>

      {/* Inflow wedge: thin on the left, thick on the right. */}
      <text x="20" y="34" fontSize="16" fontFamily="var(--mono)" fill={GREY} letterSpacing="1">
        REQUESTS PER SECOND
      </text>
      <polygon points="20,98 962,56 962,132 20,106" fill={SIGNAL_SOFT} stroke={SIGNAL} strokeWidth="1.5" />
      <path d="M962 56 L992 94 L962 132 Z" fill={SIGNAL} />

      {/* Before */}
      <rect x="20" y="170" width="400" height="240" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <text x="44" y="206" fontSize="16" fontFamily="var(--mono)" fill={GREY} letterSpacing="1">
        NORMAL · 2 PODS
      </text>
      <Pod x={48} y={236} />
      <Pod x={172} y={236} />
      <text x="44" y="392" fontSize="18" fill={GREY}>
        CPU below target. Nothing happens.
      </text>

      {/* The autoscaler reacting */}
      <line x1="440" y1="290" x2="556" y2="290" stroke={SIGNAL} strokeWidth="6" markerEnd="url(#arrow-big)" />
      <text x="498" y="262" textAnchor="middle" fontSize="19" fontWeight="650" fill={INK}>
        HPA
      </text>
      <text x="498" y="348" textAnchor="middle" fontSize="15" fontFamily="var(--mono)" fill={SIGNAL}>
        CPU &gt; target
      </text>

      {/* After */}
      <rect x="580" y="170" width="400" height="240" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <text x="604" y="206" fontSize="16" fontFamily="var(--mono)" fill={SIGNAL} letterSpacing="1">
        HIGH · 6 PODS
      </text>
      <Pod x={604} y={236} />
      <Pod x={728} y={236} isNew />
      <Pod x={852} y={236} isNew />
      <Pod x={604} y={310} />
      <Pod x={728} y={310} isNew />
      <Pod x={852} y={310} isNew />
      <text x="604" y="392" fontSize="18" fill={GREY}>
        New pods wait for readiness.
      </text>

      <text x="20" y="440" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        min 2 · max 6 · scales back in when traffic drops
      </text>
    </svg>
  )
}

/** Vertical scaling as one machine growing, horizontal as many identical ones. */
export function UpOrOutDiagram() {
  const facts = (x: number, lines: string[]) =>
    lines.map((line, i) => (
      <text key={line} x={x} y={336 + i * 23} fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        {line}
      </text>
    ))

  return (
    <svg className="s-diagram" viewBox="0 0 1000 410" role="img" aria-labelledby="upout-title">
      <title id="upout-title">
        Scaling up means one machine getting bigger. Scaling out means many identical machines.
      </title>
      <rect x="20" y="30" width="460" height="370" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <rect x="520" y="30" width="460" height="370" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />

      <text x="48" y="72" fontSize="17" fontFamily="var(--mono)" fill={INK} letterSpacing="1">
        UP · VERTICAL
      </text>
      {[
        { x: 60, y: 240, w: 78, h: 60, label: '4' },
        { x: 162, y: 198, w: 106, h: 102, label: '16' },
        { x: 292, y: 150, w: 150, h: 150, label: '64' },
      ].map((b) => (
        <g key={b.label}>
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8" fill={PANEL} stroke={GREY} strokeWidth="2" />
          <text
            x={b.x + b.w / 2}
            y={b.y + b.h / 2 + 6}
            textAnchor="middle"
            fontSize="17"
            fontFamily="var(--mono)"
            fill={INK}
          >
            {b.label}
          </text>
        </g>
      ))}
      <text x="60" y="104" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        one machine, more cores
      </text>
      {facts(60, ['ceiling: the biggest box you can rent', 'failure: all of it, at once', 'complexity: almost none'])}

      <text x="548" y="72" fontSize="17" fontFamily="var(--mono)" fill={SIGNAL} letterSpacing="1">
        OUT · HORIZONTAL
      </text>
      {[0, 1, 2].map((col) =>
        [0, 1].map((row) => (
          <rect
            key={`${col}-${row}`}
            x={560 + col * 140}
            y={170 + row * 78}
            width={120}
            height={62}
            rx="8"
            fill={SIGNAL_SOFT}
            stroke={SIGNAL}
            strokeWidth="2"
          />
        )),
      )}
      <text x="560" y="104" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        many machines, identical
      </text>
      {facts(560, ['ceiling: your own design', 'failure: one slice of it', 'complexity: real, and permanent'])}
    </svg>
  )
}

/** Why stateless scales out for free and stateful does not. */
export function StateDiagram() {
  return (
    <svg className="s-diagram" viewBox="0 0 1000 410" role="img" aria-labelledby="state-title">
      <title id="state-title">
        With no state, any machine can answer any request. With state, a request has to reach the one machine holding
        its data.
      </title>
      <defs>
        <Arrowhead id="arrow-state" color={GREY} />
        <Arrowhead id="arrow-state-signal" color={SIGNAL} />
      </defs>

      <rect x="20" y="30" width="460" height="370" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />
      <rect x="520" y="30" width="460" height="370" rx="12" fill={PANEL} stroke={LINE} strokeWidth="2" />

      <text x="48" y="72" fontSize="17" fontFamily="var(--mono)" fill={SIGNAL} letterSpacing="1">
        STATELESS
      </text>
      <rect x="170" y="108" width="160" height="50" rx="8" fill={PANEL} stroke={GREY} strokeWidth="2" />
      <text x="250" y="139" textAnchor="middle" fontSize="16" fontFamily="var(--mono)" fill={INK}>
        balancer
      </text>
      {[60, 190, 320].map((x) => (
        <g key={x}>
          <line x1="250" y1="160" x2={x + 60} y2="205" stroke={GREY} strokeWidth="2" markerEnd="url(#arrow-state)" />
          <rect x={x} y="212" width="120" height="66" rx="8" fill={SIGNAL_SOFT} stroke={SIGNAL} strokeWidth="2" />
        </g>
      ))}
      <text x="60" y="322" fontSize="18" fill={INK}>
        Any box can answer.
      </text>
      <text x="60" y="352" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        start another, point traffic at it
      </text>

      <text x="548" y="72" fontSize="17" fontFamily="var(--mono)" fill={INK} letterSpacing="1">
        STATEFUL
      </text>
      <text x="735" y="124" textAnchor="middle" fontSize="16" fontFamily="var(--mono)" fill={SIGNAL}>
        needs row B
      </text>
      <line x1="735" y1="138" x2="735" y2="205" stroke={SIGNAL} strokeWidth="3" markerEnd="url(#arrow-state-signal)" />
      {[
        { x: 560, label: 'A', hot: false },
        { x: 690, label: 'B', hot: true },
        { x: 820, label: 'C', hot: false },
      ].map((b) => (
        <g key={b.label}>
          <rect
            x={b.x}
            y="212"
            width="120"
            height="66"
            rx="8"
            fill={b.hot ? SIGNAL_SOFT : PANEL}
            stroke={b.hot ? SIGNAL : LINE}
            strokeWidth="2"
          />
          <text
            x={b.x + 60}
            y="253"
            textAnchor="middle"
            fontSize="20"
            fontFamily="var(--mono)"
            fill={b.hot ? INK : GREY}
          >
            {b.label}
          </text>
        </g>
      ))}
      <text x="560" y="322" fontSize="18" fill={INK}>
        The request must find its data.
      </text>
      <text x="560" y="352" fontSize="15" fontFamily="var(--mono)" fill={GREY}>
        replicate · shard · agree
      </text>
    </svg>
  )
}
