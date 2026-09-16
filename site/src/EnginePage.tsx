import { useMemo, useState } from 'react'
import type { DraftPolicy } from '../api/_lib/validation'
import { AiDrafter } from './AiDrafter'
import { Checkpoint } from './Checkpoint'
import { ExternalLink, PageLink, SiteFooter, SiteHeader } from './Chrome'
import { repoFile } from './content'
import { SEED_POLICIES, type Policy } from './engine'

// Ids for rules added in the browser start well clear of the seed policy ids.
const FIRST_CUSTOM_ID = 1000

export function EnginePage() {
  const [custom, setCustom] = useState<Policy[]>([])
  const policies = useMemo(() => [...SEED_POLICIES, ...custom], [custom])

  const addPolicy = (draft: DraftPolicy) =>
    setCustom((current) => [...current, { ...draft, id: FIRST_CUSTOM_ID + current.length, source: 'ai' }])

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
            You play the person and device asking to get in. The engine checks each policy from the top and stops at
            the first one where every condition is true. Try the examples to see allow, quarantine and deny.
          </p>
        </div>

        <AiDrafter onApprove={addPolicy} added={custom.length} />

        <div id="engine" className="engine-stage">
          {custom.length > 0 && (
            <div className="engine-custom-bar">
              <span>
                Using the 7 starting rules plus {custom.length} of yours.
              </span>
              <button type="button" className="button button--quiet button--small" onClick={() => setCustom([])}>
                Remove my rules
              </button>
            </div>
          )}
          <Checkpoint policies={policies} />
        </div>

        <p className="engine-note">
          The engine runs in your browser. The same rules run in the Python service, and both are tested against the
          same cases: <ExternalLink href={repoFile('site/src/engine.ts')}>engine.ts</ExternalLink> ·{' '}
          <ExternalLink href={repoFile('backend/src/mini_ise/rules.py')}>rules.py</ExternalLink> ·{' '}
          <ExternalLink href={repoFile('fixtures/policy-cases.json')}>shared test cases</ExternalLink>. Drafting uses{' '}
          <ExternalLink href={repoFile('site/api/draft.ts')}>a serverless function</ExternalLink> with per-visitor and
          daily limits.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}
