'use client'

import Link from 'next/link'
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { useLocationsWorkspace } from '@/features/appointments/kimi/locations/use-locations-workspace'
import { CreateLocationModal } from '@/components/appointments/locations/create-location-modal'
import { ArOpusPage, OpusDataSurface, OpusSearchField } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Callout, EmptyState, PageHeader, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Plus } from 'lucide-react'

export function LocationsDirectoryOpus() {
  const ws = useLocationsWorkspace()
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
        title="Locations"
        description="Manage where services are offered, which staff work there, and how customers see each location."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add location
          </Button>
        }
        meta={
          summary ? (
            <div className="flex flex-wrap gap-2">
              <Pill tone="neutral" dot={false}>{summary.active} active</Pill>
              <Pill tone="neutral" dot={false}>{summary.physical} physical</Pill>
              <Pill tone="neutral" dot={false}>{summary.virtual} virtual</Pill>
            </div>
          ) : null
        }
      />

      <OpusSearchField
        id="locations-search"
        label="Search locations"
        value={ws.q}
        onChange={ws.setQ}
        placeholder="Search name or address"
        className="mb-4 max-w-md"
      />

      {ws.error ? (
        <Callout tone="danger" title="Could not load locations">
          <Button type="button" size="sm" className="mt-2" onClick={() => void ws.reload()}>Retry</Button>
        </Callout>
      ) : ws.rows.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations yet"
          description="Add a physical studio, virtual option, or customer-location label."
          action={<Button type="button" onClick={() => setCreateOpen(true)}>Add location</Button>}
        />
      ) : (
        <OpusDataSurface className="overflow-x-auto p-0">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Location</th>
                <th scope="col" className="px-4 py-3">Type</th>
                <th scope="col" className="px-4 py-3">Address</th>
                <th scope="col" className="px-4 py-3">Services</th>
                <th scope="col" className="px-4 py-3">Staff</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {ws.rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3"><Pill tone="neutral" dot={false}>{row.typeLabel}</Pill></td>
                  <td className="px-4 py-3 text-muted-foreground">{row.addressLabel}</td>
                  <td className="px-4 py-3">{row.serviceCount}</td>
                  <td className="px-4 py-3">{row.staffCount}</td>
                  <td className="px-4 py-3"><Pill tone="neutral" dot={false}>{row.statusLabel}</Pill></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/appointments/locations/${row.id}`} className="font-medium text-primary">Open</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </OpusDataSurface>
      )}

      {createOpen ? (
        <CreateLocationModal
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            void ws.reload()
            window.location.href = `/appointments/locations/${id}`
          }}
        />
      ) : null}
    </ArOpusPage>
  )
}
