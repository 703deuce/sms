'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Plus, Users } from 'lucide-react'
import { useStaffWorkspace } from '@/features/appointments/kimi/staff/use-staff-workspace'
import { CreateStaffModal } from '@/components/appointments/staff/create-staff-modal'
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
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
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </ArOpusPage>
    )
  }

  return (
    <ArOpusPage>
      <PageHeader
        title="Staff"
        description="Manage providers, hosts, assignments, locations, and staff scheduling setup."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add staff
          </Button>
        }
        meta={
          summary ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{summary.activeStaff} active</Pill>
              <Pill tone="neutral" dot={false}>{summary.bookable} bookable</Pill>
              {summary.needsSetup > 0 ? (
                <Pill tone="warning" dot={false}>{summary.needsSetup} need setup</Pill>
              ) : null}
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <OpusSearchField
          id="staff-search"
          label="Search staff"
          value={query}
          onChange={setQuery}
          placeholder="Search name, role, email"
          className="max-w-md"
        />
        <Tabs value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="needs_setup">Needs setup</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Staff</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Services</th>
                <th scope="col" className="px-4 py-3">Locations</th>
                <th scope="col" className="px-4 py-3">Availability</th>
                <th scope="col" className="px-4 py-3">Calendar</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar initials={row.initials} url={row.avatarUrl} />
                      <div>
                        <div className="font-medium">{row.name}</div>
                        {row.email ? <div className="text-xs text-muted-foreground">{row.email}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.title || '—'}</td>
                  <td className="px-4 py-3">{row.serviceCount}</td>
                  <td className="px-4 py-3">{row.locationLabels}</td>
                  <td className="px-4 py-3">{row.availabilityLabel}</td>
                  <td className="px-4 py-3">{row.calendarConnected ? `${row.calendarLabel} ✓` : row.calendarLabel}</td>
                  <td className="px-4 py-3">
                    <Pill tone="neutral" dot={false}>{row.statusLabel}</Pill>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/appointments/staff/${row.id}`} className="font-medium text-primary">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
