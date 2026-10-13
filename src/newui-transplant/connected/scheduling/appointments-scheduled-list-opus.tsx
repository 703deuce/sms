'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Plus,
} from 'lucide-react'
import {
  ArOpusPage,
  ArStatGrid,
  OpusDataSurface,
  OpusSearchField,
  OpusTableSkeleton,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusMetricBand,
  OpusSchedulingHero,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
  appointmentStatusTone,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, EmptyState, Initials, Pill, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
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
      <OpusSchedulingHero
        icon={CalendarClock}
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
        <OpusMetricBand>
          <ArStatGrid>
            <Stat
              label="Upcoming"
              value={String(summary.upcoming)}
              icon={CalendarClock}
              hint="Visits on your calendar ahead"
            />
            <Stat
              label="Today"
              value={String(summary.today)}
              icon={CalendarCheck}
              hint="Same-day appointments"
            />
            <Stat
              label="Needs attention"
              value={String(summary.attention)}
              icon={AlertCircle}
              hint="Unpaid, forms, or follow-up"
            />
            <Stat label="Total in view" value={String(summary.total)} icon={Calendar} />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="h-9">
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
          className="w-full min-w-[220px] sm:max-w-sm"
        />
      </OpusListControls>

      {error ? (
        <Callout tone="danger" title="Could not load appointments">
          <Button type="button" size="sm" className="mt-2" onClick={load}>Retry</Button>
        </Callout>
      ) : loading ? (
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading appointments" />
        </OpusDataSurface>
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
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Customer</th>
                  <th scope="col" className={OpusTh}>Service</th>
                  <th scope="col" className={OpusTh}>When</th>
                  <th scope="col" className={OpusTh}>Staff</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => {
                  const name = row.inviteeName || 'Customer'
                  return (
                    <tr key={row.id} className="group relative hover:bg-muted/40">
                      <td className={OpusTd}>
                        <Link
                          href={`/appointments/${row.id}`}
                          className="flex items-center gap-3 font-medium after:absolute after:inset-0"
                        >
                          <Initials name={name} className="size-8" />
                          <span className="min-w-0 truncate">{name}</span>
                        </Link>
                      </td>
                      <td className={cn(OpusTd, 'text-muted-foreground')}>{row.serviceName || '—'}</td>
                      <td className={cn(OpusTd, 'tabular-nums text-muted-foreground')}>{fmt(row.startsAt)}</td>
                      <td className={OpusTd}>{row.staffName || '—'}</td>
                      <td className={OpusTd}>
                        <Pill tone={appointmentStatusTone(row.status)}>{row.status}</Pill>
                      </td>
                      <td className={cn(OpusTd, 'relative z-10 text-right')}>
                        <TextLink href={`/appointments/${row.id}`}>Open</TextLink>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </OpusDataSurface>
      )}
    </ArOpusPage>
  )
}
