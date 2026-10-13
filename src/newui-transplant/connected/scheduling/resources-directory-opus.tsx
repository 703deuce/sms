'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Box, Layers, Plus } from 'lucide-react'
import { useResourcesWorkspace } from '@/features/appointments/kimi/resources/use-resources-workspace'
import { CreateResourceModal } from '@/components/appointments/resources/create-resource-modal'
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
import Link from 'next/link'

export function ResourcesDirectoryOpus() {
  const ws = useResourcesWorkspace()
  const [createOpen, setCreateOpen] = useState(false)

  if (ws.loading && !ws.data) {
    return (
      <ArOpusPage>
        <OpusDataSurface>
          <OpusTableSkeleton label="Loading resources" />
        </OpusDataSurface>
      </ArOpusPage>
    )
  }

  const summary = ws.data?.summary

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={Box}
        title="Resources"
        description="Rooms, equipment, vehicles, and other capacity used by bookings."
        actions={
          <Button type="button" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Add resource
          </Button>
        }
      />

      {summary ? (
        <OpusMetricBand>
          <ArStatGrid>
            <Stat label="Active" value={String(summary.active)} icon={Box} />
            <Stat label="Resource pools" value={String(summary.pools)} icon={Layers} />
          </ArStatGrid>
        </OpusMetricBand>
      ) : null}

      <OpusListControls>
        <OpusSearchField
          id="resources-search"
          label="Search resources"
          value={ws.q}
          onChange={ws.setQ}
          placeholder="Search name, type, location"
          className="w-full min-w-[220px] sm:max-w-md"
        />
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm"
          value={ws.typeFilter}
          onChange={(e) => ws.setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">All types</option>
          {ws.typeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </OpusListControls>

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
        <OpusDataSurface className="overflow-hidden bg-gradient-to-br from-card via-card to-primary/[0.02] p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={OpusTh}>Resource</th>
                  <th scope="col" className={OpusTh}>Type</th>
                  <th scope="col" className={OpusTh}>Location</th>
                  <th scope="col" className={OpusTh}>Capacity</th>
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
                        href={`/appointments/resources/${row.id}`}
                        className="flex items-center gap-2 font-medium after:absolute after:inset-0"
                      >
                        <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Box className="size-4" aria-hidden />
                        </span>
                        <span className="truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className={OpusTd}>{row.typeLabel}</td>
                    <td className={cn(OpusTd, 'text-muted-foreground')}>{row.locationLabel}</td>
                    <td className={OpusTd}>{row.quantity}</td>
                    <td className={OpusTd}><Pill tone="neutral" dot={false}>{row.statusLabel}</Pill></td>
                    <td className={cn(OpusTd, 'relative z-10 text-right')}>
                      <TextLink href={`/appointments/resources/${row.id}`}>Open</TextLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
