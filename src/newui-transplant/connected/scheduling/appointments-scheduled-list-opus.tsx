'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Calendar, Plus } from 'lucide-react'
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Button } from '@/newui-transplant/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

type Row = {
  id: string
  inviteeName: string | null
  serviceName: string | null
  startsAt: string
  status: string
  staffName?: string | null
}

type Summary = {
  today: number
  upcoming: number
  attention: number
  unpaid: number
  formsDue: number
  total: number
}

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'today', label: 'Today' },
  { id: 'attention', label: 'Needs attention' },
  { id: 'all', label: 'All' },
]

export function AppointmentsScheduledListOpus() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'upcoming')
  const [q, setQ] = useState(() => searchParams.get('q') || '')
  const [rows, setRows] = useState<Row[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(false)
    const params = new URLSearchParams({ tab })
    if (q.trim()) params.set('q', q.trim())
    if (tab === 'attention') params.set('attention', '1')
    fetch(`/api/appointments?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('fetch failed')
        return r.json()
      })
      .then((json) => {
        setRows((json.data || []) as Row[])
        setSummary(json.summary || null)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [q, tab])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set('tab', tab)
    if (q) params.set('q', q)
    router.replace(`/appointments/scheduled?${params}`, { scroll: false })
  }, [q, router, tab])

  function fmt(iso: string) {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <ArOpusPage wide>
      <PageHeader
        title="Scheduled appointments"
        description="Treatment history, service records, and upcoming visits."
        actions={
          <Button type="button" nativeButton={false} render={<Link href="/appointments/new" />}>
            <Plus className="mr-2 size-4" aria-hidden />
            New appointment
          </Button>
        }
      />

      {summary ? (
        <div className="flex flex-wrap gap-2">
          <Pill tone="neutral">{summary.upcoming} upcoming</Pill>
          <Pill tone="neutral">{summary.today} today</Pill>
          <Pill tone="neutral">{summary.attention} need attention</Pill>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <OpusSearchField
        id="scheduled-search"
        label="Search appointments"
        value={q}
        onChange={setQ}
        placeholder="Search customer or service"
        className="max-w-md"
      />

      {error ? (
        <Callout tone="danger" title="Could not load appointments">
          <Button type="button" size="sm" className="mt-2" onClick={load}>Retry</Button>
        </Callout>
      ) : loading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No appointments in this view"
          description="Try another tab or create a new appointment."
          action={
            <Button type="button" nativeButton={false} render={<Link href="/appointments/new" />}>
              New appointment
            </Button>
          }
        />
      ) : (
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Customer</th>
                <th scope="col" className="px-4 py-3">Service</th>
                <th scope="col" className="px-4 py-3">When</th>
                <th scope="col" className="px-4 py-3">Staff</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium">{row.inviteeName || '—'}</td>
                  <td className="px-4 py-3">{row.serviceName || '—'}</td>
                  <td className="px-4 py-3">{fmt(row.startsAt)}</td>
                  <td className="px-4 py-3">{row.staffName || '—'}</td>
                  <td className="px-4 py-3">
                    <Pill tone="neutral">{row.status}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/appointments/${row.id}`} className="text-sm font-medium text-primary">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
