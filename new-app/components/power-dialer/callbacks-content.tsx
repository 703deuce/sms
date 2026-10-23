'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Page, PageHeader, Panel, EmptyState } from '@/components/app/page-primitives'
import { SegmentedFilter } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { fetchPowerDialerCallbacks, type PowerDialerCallbackDto } from '@/lib/phone-api'
import { formatPhone, formatWhen } from '@/lib/format'
import { CalendarClock } from 'lucide-react'

const TABS = [
  { value: 'due_today', label: 'Due today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
] as const

export function PowerDialerCallbacksContent({ initialTab = 'due_today' }: { initialTab?: string }) {
  const [tab, setTab] = useState(initialTab)
  const [rows, setRows] = useState<PowerDialerCallbackDto[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchPowerDialerCallbacks(tab)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load callbacks'))
  }, [tab])

  return (
    <Page>
      <PageHeader
        title="Callbacks"
        description="Scheduled follow-ups from power-dialer dispositions. Times use each campaign’s timezone setting."
      />
      <Panel bodyClassName="p-0">
        <div className="border-b p-4">
          <SegmentedFilter label="Callback queue" value={tab} onChange={setTab} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
        </div>
        {error && (
          <p className="px-5 py-3 text-sm text-destructive" role="alert">{error}</p>
        )}
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No callbacks in this queue"
            description="Schedule a callback from the dialer disposition flow. Callbacks appear here when a disposition sets callbackAt."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th scope="col" className="px-4 py-2.5 font-medium">Contact</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Campaign</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Scheduled</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Last disposition</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.contactName}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{formatPhone(r.contactPhone)}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.campaignName}</td>
                  <td className="px-4 py-3">{r.callbackAt ? formatWhen(r.callbackAt) : '—'}</td>
                  <td className="px-4 py-3">{r.disposition || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={r.contactStatus === 'BLOCKED' ? 'danger' : 'neutral'}>
                      {r.contactStatus === 'BLOCKED' ? 'Suppressed' : r.status}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">
        Automated callback dialing is not enabled yet. Use{' '}
        <Link href="/app/power-dialer/dialer" className="text-primary hover:underline">Dialer</Link> to call back when eligible.
      </p>
    </Page>
  )
}
