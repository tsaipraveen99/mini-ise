import { api } from './api'
import { DecisionFeed, PolicyDrafter, PolicyList, StatsBar } from './components'
import { usePolling } from './lib'

export default function App() {
  const decisions = usePolling(api.decisions, 1000)
  const stats = usePolling(api.stats, 2000)
  const policies = usePolling(api.policies, 5000)
  const offline = decisions.error ?? stats.error ?? policies.error

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo" aria-hidden="true">◆</span>
          <div>
            <h1>Mini ISE</h1>
            <p>Zero-trust network access console</p>
          </div>
        </div>
        <span className={`live ${offline ? 'live-down' : ''}`}>
          {offline ? `Policy API unreachable: ${offline}` : 'Live'}
        </span>
      </header>

      <StatsBar stats={stats.data} />

      <main className="layout">
        <DecisionFeed decisions={decisions.data} />
        <aside className="side">
          <PolicyDrafter onApproved={policies.reload} />
          <PolicyList policies={policies.data} onChanged={policies.reload} />
        </aside>
      </main>
    </div>
  )
}
