'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Clock, ListOrdered, Search } from 'lucide-react'
import type { WaitlistEntry } from '@/components/appointments/kimi-ui/waitlist/mock-data'
import { WaitlistEntryRow } from '@/components/appointments/kimi-ui/waitlist/components/WaitlistEntryRow'
import { ConfirmRemoveModal } from '@/components/appointments/kimi-ui/waitlist/components/ConfirmRemoveModal'
import { SchedulingOpusPage } from '@/newui-transplant/connected/scheduling/scheduling-opus-page'
import {
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusMetricBand,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, EmptyState, Stat } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

type StatusFilter = 'all' | 'active' | 'notified' | 'accepted' | 'expired' | 'removed'

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'notified', label: 'Notified' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'expired', label: 'Expired' },
  { key: 'removed', label: 'Removed' },
]

export function WaitlistAdminOpus() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [pendingRemove, setPendingRemove] = useState<WaitlistEntry | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3200)
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    fetch('/api/appointments/waitlist')
      .then((r) => r.json())
      .then((j) => {
        setEntries(j.data || [])
        setLoading(false)
      })
      .catch(() => {
        setFailed(true)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function patchEntry(entryId: string, action: 'notify' | 'remove' | 'reactivate') {
    setActing(entryId)
    try {
      await fetch('/api/appointments/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entryId, action }),
      })
      load()
    } finally {
      setActing(null)
      if (action === 'notify') showToast('Customer notified about the opening.')
      if (action === 'reactivate') showToast('Entry reactivated.')
      if (action === 'remove') showToast('Entry removed from the waitlist.')
    }
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: entries.length }
    for (const e of entries) c[e.status] = (c[e.status] || 0) + 1
    return c
  }, [entries])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return entries.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false
      if (!q) return true
      return [e.serviceName, e.phone, e.email]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    })
  }, [entries, query, statusFilter])

  return (
    <SchedulingOpusPage
      icon={ListOrdered}
      title="Waitlist"
      description="Customers waiting for an opening. Notify them when a slot becomes available."
    >
      <OpusMetricBand>
        <ArStatGrid>
          <Stat label="Active" value={String(counts.active || 0)} icon={Clock} />
          <Stat label="Total entries" value={String(counts.all || 0)} icon={ListOrdered} />
        </ArStatGrid>
      </OpusMetricBand>

      <OpusListControls>
        <OpusSearchField
          id="waitlist-search"
          label="Search waitlist"
          placeholder="Service, phone, or email"
          value={query}
          onChange={setQuery}
          className="w-full min-w-[220px] sm:max-w-md"
        />
        <Tabs
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <TabsList className="flex h-auto max-w-full flex-wrap">
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.key} value={f.key} className="text-xs">
                {f.label} ({counts[f.key] || 0})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </OpusListControls>

      {toast ? (
        <p className="mb-3 text-sm text-muted-foreground" role="status">{toast}</p>
      ) : null}

      {loading ? (
        <OpusDataSurface>
          <OpusTableSkeleton rows={5} label="Loading waitlist" />
        </OpusDataSurface>
      ) : failed ? (
        <Callout tone="error" title="Could not load waitlist">
          <Button type="button" variant="outline" size="sm" onClick={load}>Retry</Button>
        </Callout>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Search}
          title={query || statusFilter !== 'all' ? 'No matching entries' : 'Waitlist is empty'}
          description="When customers join a waitlist, they appear here for notification."
        />
      ) : (
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <table className="w-full text-sm">
            <thead className={OPUS_TABLE_HEAD}>
              <tr>
                <th scope="col" className={OpusTh}>Customer</th>
                <th scope="col" className={OpusTh}>Service</th>
                <th scope="col" className={OpusTh}>Status</th>
                <th scope="col" className={cn(OpusTh, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((entry) => (
                <WaitlistEntryRow
                  key={entry.id}
                  entry={entry}
                  acting={acting === entry.id}
                  onNotify={() => void patchEntry(entry.id, 'notify')}
                  onRemove={() => setPendingRemove(entry)}
                  onReactivate={() => void patchEntry(entry.id, 'reactivate')}
                />
              ))}
            </tbody>
          </table>
        </OpusDataSurface>
      )}

      {pendingRemove ? (
        <ConfirmRemoveModal
          entry={pendingRemove}
          onCancel={() => setPendingRemove(null)}
          onConfirm={() => {
            void patchEntry(pendingRemove.id, 'remove')
            setPendingRemove(null)
          }}
        />
      ) : null}
    </SchedulingOpusPage>
  )
}
