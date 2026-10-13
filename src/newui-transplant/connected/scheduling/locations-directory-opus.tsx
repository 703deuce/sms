'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Building2, MapPin, Monitor, Plus } from 'lucide-react'
import { useLocationsWorkspace } from '@/features/appointments/kimi/locations/use-locations-workspace'
import { CreateLocationModal } from '@/components/appointments/locations/create-location-modal'
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

export function LocationsDirectoryOpus() {
  const ws = useLocationsWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  if (ws.loading && !ws.data) {
    return (
      <ArOpusPage>
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading locations" />
        </OpusDataSurface>
      </ArOpusPage>
    )
  }

  const summary = ws.data?.summary

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={MapPin}
        title="Locations"
        description="Manage where services are offered, which staff work there, and how customers see each location."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add location
          </Button>
        }
      />

      {summary ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Active" value={String(summary.active)} icon={MapPin} />
            <Stat label="Physical" value={String(summary.physical)} icon={Building2} />
            <Stat label="Virtual" value={String(summary.virtual)} icon={Monitor} />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <OpusSearchField
          id="locations-search"
          label="Search locations"
          value={ws.q}
          onChange={ws.setQ}
          placeholder="Search name or address"
          className="w-full min-w-[220px] sm:max-w-md"
        />
      </OpusListControls>

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
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Location</th>
                  <th scope="col" className={OpusTh}>Type</th>
                  <th scope="col" className={OpusTh}>Address</th>
                  <th scope="col" className={OpusTh}>Services</th>
                  <th scope="col" className={OpusTh}>Staff</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {ws.rows.map((row) => (
                  <tr key={row.id} className="group relative hover:bg-muted/40">
                    <td className={OpusTd}>
                      <Link
                        href={`/appointments/locations/${row.id}`}
                        className="flex items-center gap-2 font-medium after:absolute after:inset-0"
                      >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPin className="size-4" aria-hidden />
                        </span>
                        <span className="truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className={OpusTd}><Pill tone="neutral" dot={false}>{row.typeLabel}</Pill></td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>{row.addressLabel}</td>
                    <td className={OpusTd}>{row.serviceCount}</td>
                    <td className={OpusTd}>{row.staffCount}</td>
                    <td className={OpusTd}><Pill tone="success" dot={false}>{row.statusLabel}</Pill></td>
                    <td className={cn(OpusTd, 'relative z-10 text-right')}>
                      <TextLink href={`/appointments/locations/${row.id}`}>Open</TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
