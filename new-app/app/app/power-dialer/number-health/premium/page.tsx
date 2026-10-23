'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'
import { fetchPowerDialerSettings } from '@/lib/phone-api'

export default function PowerDialerPremiumReputationPage() {
  const [entitled, setEntitled] = useState(false)

  useEffect(() => {
    void fetchPowerDialerSettings().then((s) => setEntitled(Boolean(s.premiumReputationEntitlement)))
  }, [])

  return (
    <Page>
      <PageHeader
        title="Premium reputation"
        description="Official reputation scores require Telnyx Number Reputation API access. Transovo never fabricates spam scores."
        breadcrumbs={[
          { label: 'Number health', href: '/app/power-dialer/number-health' },
          { label: 'Premium' },
        ]}
      />
      <Panel title="Official reputation scores">
        <p className="text-sm text-muted-foreground">
          Status: <strong>{entitled ? 'Entitlement flagged on workspace' : 'Not enabled'}</strong>
        </p>
        <p className="mt-3 text-sm">
          Telnyx documents Number Reputation as a paid add-on (approximately $100/month per business in public pricing).
          This environment does not auto-purchase features. Request enablement from your Telnyx account team, then ask
          Transovo support to flip the workspace entitlement for scheduled checks and history.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          Engineering probe: run <code className="font-mono">npx tsx scripts/probe-telnyx-number-reputation.ts</code> with
          production credentials to see whether API endpoints respond.
        </p>
      </Panel>
      <Panel title="Transovo performance metrics">
        <p className="text-sm text-muted-foreground">
          Answer rate, human conversation rate, and screening counters on the{' '}
          <Link href="/app/power-dialer/number-health" className="text-primary hover:underline">main number health</Link>{' '}
          page are calculated from your call history — not carrier spam labels.
        </p>
      </Panel>
      <p className="text-xs text-muted-foreground">
        <Link href="/app/power-dialer/number-health" className="text-primary hover:underline">Back to number health</Link>
      </p>
    </Page>
  )
}
