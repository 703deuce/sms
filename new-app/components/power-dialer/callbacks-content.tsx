'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Page, PageHeader, Panel, EmptyState } from '@/components/app/page-primitives'
import { SegmentedFilter } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { Button } from '@/components/ui/button'
import {
  fetchPowerDialerCallbacks,
  fetchPowerDialerCallbackEligibility,
  patchPowerDialerCallback,
  type PowerDialerCallbackDto,
} from '@/lib/phone-api'
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
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabFromUrl = searchParams.get('tab') || initialTab
  const [tab, setTab] = useState(tabFromUrl)

  useEffect(() => {
    setTab(tabFromUrl)
  }, [tabFromUrl])

  const changeTab = (next: string) => {
    setTab(next)
    const q = new URLSearchParams(searchParams.toString())
    q.set('tab', next)
    router.replace(`/app/power-dialer/callbacks?${q.toString()}`, { scroll: false })
  }
  const [rows, setRows] = useState<PowerDialerCallbackDto[]>([])
  const [error, setError] = useState<string | null>(null)

  const reload = () => {
    void fetchPowerDialerCallbacks(tab)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load callbacks'))
  }

  useEffect(() => {
    reload()
  }, [tab])

  const complete = async (id: string) => {
    try {
      await patchPowerDialerCallback(id, { action: 'complete' })
      toast.success('Callback completed')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const cancel = async (id: string) => {
    try {
      await patchPowerDialerCallback(id, { action: 'cancel' })
      toast.success('Callback cancelled')
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  const startCall = async (r: PowerDialerCallbackDto) => {
    try {
      const elig = await fetchPowerDialerCallbackEligibility(r.id)
      if (!elig.eligible) {
        toast.error(elig.message || 'This contact cannot be dialed right now')
        return
      }
      window.location.href = `/app/power-dialer/dialer?campaign=${encodeURIComponent(r.campaignId)}&contact=${encodeURIComponent(r.contactId)}`
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eligibility check failed')
    }
  }

  return (
    <Page>
      <PageHeader
        title="Callbacks"
        description="Scheduled follow-ups from power-dialer dispositions. Times use each campaign’s timezone setting."
      />
      <Panel bodyClassName="p-0">
        <div className="border-b p-4">
          <SegmentedFilter label="Callback queue" value={tab} onChange={changeTab} options={TABS.map((t) => ({ value: t.value, label: t.label }))} />
        </div>
        {error && (
          <p className="px-5 py-3 text-sm text-destructive" role="alert">{error}</p>
        )}
        {rows.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No callbacks in this queue"
            description="Schedule a callback from the dialer disposition flow. Callbacks appear here when an outcome is saved with a follow-up time."
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
                <th scope="col" className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const suppressed = r.contactStatus === 'BLOCKED' || r.contactStatus === 'UNSUBSCRIBED'
                return (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <span className="font-medium">{r.contactName}</span>
                      <span className="block font-mono text-xs text-muted-foreground">{formatPhone(r.contactPhone)}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.campaignName}</td>
                    <td className="px-4 py-3">{r.callbackAt ? formatWhen(r.callbackAt) : '—'}</td>
                    <td className="px-4 py-3">{r.disposition || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={suppressed ? 'danger' : 'neutral'}>
                        {suppressed ? 'Ineligible' : r.status}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {suppressed ? (
                          <span className="text-xs text-muted-foreground">Blocked</span>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="link"
                            className="h-7 px-0 text-xs"
                            onClick={() => void startCall(r)}
                          >
                            Start call
                          </Button>
                        )}
                        {r.status === 'scheduled' && (
                          <>
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void complete(r.id)}>
                              Complete
                            </Button>
                            <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => void cancel(r.id)}>
                              Cancel
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </Page>
  )
}
