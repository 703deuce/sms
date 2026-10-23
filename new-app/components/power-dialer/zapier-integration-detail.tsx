'use client'

import Link from 'next/link'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

export function ZapierIntegrationDetail() {
  return (
    <Page>
      <PageHeader
        title="Zapier"
        description="Workspace API automation — not a published Zapier marketplace listing."
        breadcrumbs={[
          { label: 'Integrations', href: '/app/power-dialer/integrations' },
          { label: 'Zapier' },
        ]}
      />
      <Panel title="Setup">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>
            Create a workspace API key under{' '}
            <Link href="/app/power-dialer/settings?tab=developer" className="text-primary hover:underline">
              Settings → API &amp; Webhooks
            </Link>
            .
          </li>
          <li>In Zapier, choose Webhooks by Zapier or REST hooks with Bearer auth using that key.</li>
          <li>Point polling triggers at your Transovo app base URL (same host you use to sign in).</li>
        </ol>
      </Panel>
      <Panel title="Triggers (polling GET)">
        <ul className="space-y-2 text-sm font-mono">
          <li>/api/v1/zapier/polling/contacts — new/updated contacts for lead sync</li>
          <li>/api/v1/zapier/polling/callbacks — scheduled callbacks (disposition or AI bridge)</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Polling returns only rows your key is allowed to read; empty arrays are normal when nothing changed.</p>
      </Panel>
      <Panel title="Actions (POST)">
        <ul className="space-y-2 text-sm font-mono">
          <li>/api/v1/zapier/actions/contacts — create or update a contact (leadSource=zapier)</li>
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          After Zap creates a contact, add them to a calling list via Power Dialer → Calling lists → Import or campaign membership APIs.
        </p>
      </Panel>
      <Panel title="Troubleshooting">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li><strong>401 Unauthorized</strong> — missing, wrong, or revoked API key; rotate in Settings.</li>
          <li><strong>Empty polling</strong> — no new events since last poll cursor; not a failure.</li>
          <li><strong>Duplicate contacts</strong> — phone is unique per workspace; action upserts by phone where supported.</li>
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">
          We do not claim a Zapier App Directory listing. Use custom Zaps with documented REST endpoints only.
        </p>
      </Panel>
    </Page>
  )
}
