'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel } from '@/components/app/page-primitives'

type Row = {
  id: string
  provider: string
  operation: string
  status: string
  errorMessage: string | null
  createdAt: string
  idempotencyKey: string
}

export default function PowerDialerSyncHistoryPage() {
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    void fetch('/api/phone/power-dialer/integrations/sync-history')
      .then((r) => r.json())
      .then((j) => setRows(j.data?.powerDialer || []))
  }, [])

  return (
    <Page>
      <PageHeader
        title="Sync history"
        description="Power-dialer CRM writebacks and bus events (idempotent per attempt)."
        breadcrumbs={[
          { label: 'Integrations', href: '/app/power-dialer/integrations' },
          { label: 'Sync history' },
        ]}
      />
      <Panel title="Recent sync attempts" bodyClassName="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th scope="col" className="px-4 py-2 font-medium">When</th>
              <th scope="col" className="px-4 py-2 font-medium">Provider</th>
              <th scope="col" className="px-4 py-2 font-medium">Operation</th>
              <th scope="col" className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No sync log entries yet.</td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="px-4 py-2">{new Date(r.createdAt).toLocaleString()}</td>
                <td className="px-4 py-2">{r.provider}</td>
                <td className="px-4 py-2">{r.operation}</td>
                <td className="px-4 py-2">
                  {r.status}
                  {r.errorMessage && <span className="block text-xs text-destructive">{r.errorMessage}</span>}
                  {r.status === 'failed' && (
                    <button
                      type="button"
                      className="mt-1 text-xs text-primary hover:underline"
                      onClick={() => {
                        void fetch(`/api/phone/power-dialer/integrations/sync-history/${r.id}/retry`, {
                          method: 'POST',
                        }).then(() => window.location.reload())
                      }}
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <p className="text-xs text-muted-foreground">
        <Link href="/app/power-dialer/integrations" className="text-primary hover:underline">Back to integrations</Link>
      </p>
    </Page>
  )
}
