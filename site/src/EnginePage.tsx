import { Checkpoint } from './Checkpoint'
import { PageLink, SiteFooter, SiteHeader } from './Chrome'
import { repoFile } from './content'

export function EnginePage() {
  return (
    <div className="page">
      <a className="skip-link" href="#engine">
        Skip to the engine
      </a>
      <SiteHeader page="engine" />

      <main className="engine-page">
        <div className="engine-intro">
          <PageLink hash="#top" className="back-link">
            <span aria-hidden="true">←</span> Back to overview
          </PageLink>
          <h1>Policy engine</h1>
          <p>
            Describe a device on the left. The engine checks each policy from the top and stops at the first one where
            every condition is true. Try the examples to see allow, quarantine and deny.
          </p>
        </div>

        <div id="engine">
          <Checkpoint />
        </div>

        <p className="engine-note">
          This runs in your browser. The same rules run in the Python service, and both are tested against the same
          cases: <a href={repoFile('site/src/engine.ts')}>engine.ts</a> ·{' '}
          <a href={repoFile('backend/src/mini_ise/rules.py')}>rules.py</a> ·{' '}
          <a href={repoFile('fixtures/policy-cases.json')}>shared test cases</a>
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
