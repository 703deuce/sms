'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Box, Plus } from 'lucide-react'
import { useResourcesWorkspace } from '@/features/appointments/kimi/resources/use-resources-workspace'
import { CreateResourceModal } from '@/components/appointments/resources/create-resource-modal'
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'

export function ResourcesDirectoryOpus() {
  const ws = useResourcesWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  if (ws.loading && !ws.data) {
    return (
      <ArOpusPage>
        <div className="h-48 animate-pulse rounded-xl bg-muted/40" />
      </ArOpusPage>
    )
  }

  const summary = ws.data?.summary

  return (
    <ArOpusPage>
      <PageHeader
        title="Resources"
        description="Rooms, equipment, vehicles, and other capacity used by bookings."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add resource
          </Button>
        }
        meta={
          summary ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{summary.active} active</Pill>
              <Pill tone="neutral" dot={false}>{summary.pools} pools</Pill>
            </div>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <OpusSearchField
          id="resources-search"
          label="Search resources"
          value={ws.q}
          onChange={ws.setQ}
          placeholder="Search name, type, location"
          className="max-w-md"
        />
        <select
          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={ws.typeFilter}
          onChange={(e) => ws.setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {ws.typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {ws.error ? (
        <Callout tone="danger" title="Could not load resources">
          <Button type="button" size="sm" className="mt-2" onClick={() => void ws.reload()}>Retry</Button>
        </Callout>
      ) : ws.rows.length === 0 ? (
        <EmptyState
          icon={Box}
          title="No resources yet"
          description="Add rooms, chairs, or equipment that limit how many bookings can run at once."
          action={<Button type="button" onClick={() => setCreateOpen(true)}>Add resource</Button>}
        />
      ) : (
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Resource</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Capacity</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {ws.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3">{row.typeLabel}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.locationLabel}</td>
                  <td className="px-4 py-3">{row.quantity}</td>
                  <td className="px-4 py-3"><Pill tone="neutral" dot={false}>{row.statusLabel}</Pill></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/appointments/resources/${row.id}`} className="font-medium text-primary">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpusDataSurface>
      )}

      {createOpen && ws.data ? (
        <CreateResourceModal
          onClose={() => setCreateOpen(false)}
          locations={ws.data.locations}
          services={ws.data.types}
          onCreated={(id) => {
            setCreateOpen(false)
            void ws.reload()
            window.location.href = `/appointments/resources/${id}`
          }}
        />
      ) : null}
    </ArOpusPage>
  )
}
