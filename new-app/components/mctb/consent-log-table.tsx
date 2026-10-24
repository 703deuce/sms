'use client'

import { useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { formatPhone, formatWhen } from '@/lib/format'

type Row = {
  id: string
  callerNumber: string
  businessNumber: string
  consentMethod: string
  consentedAt: string
  consentMode: string | null
  missedCallStatus: string | null
}

export function ConsentLogTable() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetch('/api/mctb/consent-log?limit=100')
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setRows(j.data.events as Row[])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-muted-foreground">Loading consent events…</p>

  return (
    <Panel title="Recent consent events">
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No consent events in this workspace yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Caller</th>
                <th className="py-2 pr-4 font-medium">Method</th>
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 font-medium">Missed call status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60">
                  <td className="py-2 pr-4 font-mono">{formatPhone(r.callerNumber)}</td>
                  <td className="py-2 pr-4">{r.consentMethod.replace(/_/g, ' ')}</td>
                  <td className="py-2 pr-4">{formatWhen(r.consentedAt)}</td>
                  <td className="py-2">{r.missedCallStatus ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
