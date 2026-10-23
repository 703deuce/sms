'use client'

import Link from 'next/link'
import { Panel } from '@/components/app/page-primitives'

export function ZapierIntegrationPanel() {
  return (
    <Panel
      title="Zapier"
      description="Connect Transovo Power Dialer lead events with Zaps using your workspace API key. This is not a published Zapier marketplace app — use polling triggers and REST actions documented below."
    >
      <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        <li>
          Generate an API key under{' '}
          <Link href="/app/power-dialer/settings?tab=developer" className="text-primary hover:underline">
            Settings → API &amp; Webhooks
          </Link>
          .
        </li>
        <li>
          Polling triggers (GET, API key):{' '}
          <code className="text-xs">/api/v1/zapier/polling/contacts</code>,{' '}
          <code className="text-xs">/api/v1/zapier/polling/callbacks</code> (see developer docs in-repo).
        </li>
        <li>
          Actions (POST):{' '}
          <code className="text-xs">/api/v1/zapier/actions/contacts</code> to create or update contacts for calling lists.
        </li>
        <li>Lead sync pattern: Zap creates/updates a contact → add to a calling list via Power Dialer list import or campaign membership APIs.</li>
      </ol>
      <p className="mt-4 text-xs text-muted-foreground">
        Auth: Bearer token with your workspace API key. 401 responses mean the key is missing or revoked — rotate keys in Settings.
      </p>
    </Panel>
  )
}
