'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarCheck, Plus, UserCheck, Users } from 'lucide-react'
import { useStaffWorkspace } from '@/features/appointments/kimi/staff/use-staff-workspace'
import { CreateStaffModal } from '@/components/appointments/staff/create-staff-modal'
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
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { Callout, EmptyState, Pill, Stat, TextLink } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'

type StatusFilter = 'all' | 'active' | 'inactive' | 'needs_setup'

function Avatar({ initials, url }: { initials: string; url: string | null }) {
  if (url) {
    return <img src={url} alt="" className="h-8 w-8 rounded-full object-cover" />
  }
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
      {initials}
    </span>
  )
}

export function StaffDirectoryOpus() {
  const ws = useStaffWorkspace()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [createOpen, setCreateOpen] = useState(false)

  const rows = useMemo(() => {
    const list = ws.data?.directory || []
    return list.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      const q = query.trim().toLowerCase()
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.title || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q)
      )
    })
  }, [ws.data, filter, query])

  const summary = ws.data?.summary

  if (ws.loading) {
    return (
      <ArOpusPage>
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading staff" />
        </OpusDataSurface>
      </ArOpusPage>
    )
  }

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Users}
        title="Staff"
        description="Manage providers, hosts, assignments, locations, and staff scheduling setup."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add staff
          </Button>
        }
      />

      {summary ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Active staff" value={String(summary.activeStaff)} icon={UserCheck} />
            <Stat label="Bookable" value={String(summary.bookable)} icon={CalendarCheck} />
            <Stat
              label="Needs setup"
              value={String(summary.needsSetup)}
              icon={AlertTriangle}
              hint={summary.needsSetup > 0 ? 'Finish availability or services' : 'All set'}
            />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList className="h-9">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="needs_setup">Needs setup</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
        <OpusSearchField
          id="staff-search"
          label="Search staff"
          value={query}
          onChange={setQuery}
          placeholder="Search name, role, email"
          className="w-full min-w-[220px] sm:max-w-md"
        />
      </OpusListControls>

      {ws.error ? (
        <Callout tone="danger" title="Could not load staff">
          <Button type="button" size="sm" className="mt-2" onClick={() => void ws.reload()}>Retry</Button>
        </Callout>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No staff yet"
          description="Add your first provider to assign services and locations."
          action={<Button type="button" onClick={() => setCreateOpen(true)}>Add staff</Button>}
        />
      ) : (
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Staff</th>
                  <th scope="col" className={OpusTh}>Role</th>
                  <th scope="col" className={OpusTh}>Services</th>
                  <th scope="col" className={OpusTh}>Locations</th>
                  <th scope="col" className={OpusTh}>Availability</th>
                  <th scope="col" className={OpusTh}>Calendar</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id} className="group relative hover:bg-muted/40">
                    <td className={OpusTd}>
                      <Link
                        href={`/appointments/staff/${row.id}`}
                        className="flex items-center gap-3 after:absolute after:inset-0"
                      >
                        <Avatar initials={row.initials} url={row.avatarUrl} />
                        <div className="min-w-0">
                          <div className="font-medium truncate">{row.name}</div>
                          {row.email ? <div className="truncate text-xs text-muted-foreground">{row.email}</div> : null}
                        </div>
                      </Link>
                    </td>
                    <td className={OpusTd}>{row.title || '—'}</td>
                    <td className={OpusTd}>{row.serviceCount}</td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>{row.locationLabels}</td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>{row.availabilityLabel}</td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>
                      {row.calendarConnected ? `${row.calendarLabel} ✓` : row.calendarLabel}
                    </td>
                    <td className={OpusTd}>
                      <Pill tone={row.status === 'needs_setup' ? 'warning' : row.status === 'active' ? 'success' : 'neutral'} dot={false}>
                        {row.statusLabel}
                      </Pill>
                    </td>
                    <td className={cn(OpusTd, 'relative z-10 text-right')}>
                      <TextLink href={`/appointments/staff/${row.id}`}>Open</TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </OpusDataSurface>
      )}

      {createOpen ? (
        <CreateStaffModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            void ws.reload()
            window.location.href = `/appointments/staff/${id}`
          }}
        />
      ) : null}
    </ArOpusPage>
  )
}
