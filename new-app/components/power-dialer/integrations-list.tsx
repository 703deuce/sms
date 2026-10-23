'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { StatusBadge } from '@/components/app/status'

export function PowerDialerIntegrationsList() {
  const [providers, setProviders] = useState<
    {
      provider: string
      status: string
      connected: boolean
      supportedOperations: string[]
      lastSyncAt: string | null
    }[]
  >([])

  useEffect(() => {
    void fetch('/api/phone/power-dialer/integrations')
      .then((r) => r.json())
      .then((j) => setProviders(j.data?.providers || []))
  }, [])

  return (
    <Panel title="CRM connections" description="Configure sync per provider on the detail page.">
      <ul className="divide-y text-sm">
        {providers.map((p) => (
          <li key={p.provider} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <div>
              <Link href={`/app/power-dialer/integrations/${p.provider}`} className="font-medium capitalize hover:text-primary">
                {p.provider}
              </Link>
              <p className="text-xs text-muted-foreground">{p.supportedOperations.join(' · ') || 'No supported ops'}</p>
            </div>
            <StatusBadge tone={p.connected ? 'success' : 'muted'}>{p.status}</StatusBadge>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted-foreground">
        Global OAuth: <Link href="/app/integrations" className="text-primary hover:underline">Integrations</Link>
      </p>
    </Panel>
  )
}
