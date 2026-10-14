'use client'

import Link from 'next/link'
import { MoreHorizontal, Plus, Users } from 'lucide-react'
import type { ClassSeriesRow } from '@/lib/appointments/classes/class-form'
import {
  nextOccurrenceSummary,
  scheduleSummaryForClass,
} from '@/lib/appointments/classes/class-display'
import { parseClassSeriesMetadata } from '@/lib/appointments/class-series-offering'
import {
  ArOpusPage,
  OpusDataSurface,
  OpusSearchField,
} from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import {
  OpusListControls,
  OpusTd,
  OpusTh,
  OPUS_TABLE_HEAD,
} from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { SchedulingPageHeader } from '@/components/appointments/scheduling-opus/scheduling-page-header'
import { OfferingCatalogProductCell } from '@/components/appointments/scheduling-opus/offering-catalog-product-cell'
import { Button } from '@/newui-transplant/components/ui/button'
import { Callout, EmptyState, Pill } from '@/newui-transplant/components/app/kit'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/newui-transplant/components/ui/dropdown-menu'

function classPriceLabel(row: ClassSeriesRow): string {
  const meta = parseClassSeriesMetadata(row.metadata)
  if (meta.isFree !== false && !(meta.priceCents && meta.priceCents > 0)) return 'Free'
  if (meta.priceCents && meta.priceCents > 0) return `$${(meta.priceCents / 100).toFixed(2)}`
  return '—'
}

function enrollmentSummary(row: ClassSeriesRow): string {
  const cap = row.capacity ?? 0
  let enrolled = 0
  for (const o of row.occurrences || []) {
    enrolled = Math.max(enrolled, o.enrolled ?? 0)
  }
  return `${enrolled}/${cap}`
}

type Props = {
  rows: ClassSeriesRow[]
  loading: boolean
  failed: boolean
  search: string
  onSearchChange: (v: string) => void
  onRetry: () => void
  newHref: string
  detailHref: (id: string) => string
}

export function ClassesCatalogOpusTable({
  rows,
  loading,
  failed,
  search,
  onSearchChange,
  onRetry,
  newHref,
  detailHref,
}: Props) {
  const q = search.trim().toLowerCase()
  const filtered = rows.filter((c) => !q || c.name.toLowerCase().includes(q))

  return (
    <ArOpusPage>
      <SchedulingPageHeader
        icon={Users}
        title="Classes"
        description="Scheduled group sessions customers can register for."
        actions={
          <Button nativeButton={false} render={<Link href={newHref} />}>
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            Create class
          </Button>
        }
      />

      <OpusListControls className="mt-5 min-h-[3.25rem]">
        <OpusSearchField
          id="classes-catalog-search"
          label="Search classes"
          value={search}
          onChange={onSearchChange}
          placeholder="Search by name"
          className="h-10 w-full min-w-[280px] sm:max-w-[320px]"
        />
      </OpusListControls>

      {loading ? (
        <OpusDataSurface className="mt-3 min-h-[12rem] animate-pulse p-6" aria-busy="true">
          <span className="sr-only">Loading classes</span>
        </OpusDataSurface>
      ) : failed ? (
        <Callout tone="warning" title="Could not load classes" className="mt-3">
          <Button type="button" size="sm" className="mt-2" onClick={onRetry}>Retry</Button>
        </Callout>
      ) : filtered.length === 0 ? (
        <OpusDataSurface className="mt-3 flex min-h-[13.75rem] items-center justify-center p-6">
          <EmptyState
            icon={Users}
            title={q ? 'No matching classes' : 'No classes yet'}
            description="Create a scheduled group session customers can register for."
            action={
              <Button nativeButton={false} render={<Link href={newHref} />}>Create class</Button>
            }
          />
        </OpusDataSurface>
      ) : (
        <OpusDataSurface className="mt-3 overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={cn(OpusTh, 'w-[28%]')}>Class</th>
                  <th scope="col" className={OpusTh}>Next session</th>
                  <th scope="col" className={OpusTh}>Schedule</th>
                  <th scope="col" className={OpusTh}>Enrolled</th>
                  <th scope="col" className={OpusTh}>Price</th>
                  <th scope="col" className={OpusTh}>Status</th>
                  <th scope="col" className={cn(OpusTh, 'text-right')}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map((row) => {
                  const meta = parseClassSeriesMetadata(row.metadata)
                  const active = row.active !== false
                  return (
                    <tr key={row.id} className="min-h-[4.5rem] hover:bg-muted/40">
                      <th scope="row" className={cn(OpusTd, 'py-3 font-normal')}>
                        <OfferingCatalogProductCell
                          href={detailHref(row.id)}
                          name={row.name}
                          description={row.description}
                          imageUrl={meta.imageUrl}
                          category={row.requireFullSeries ? 'course' : 'class'}
                        />
                      </th>
                      <td className={cn(OpusTd, 'whitespace-nowrap text-muted-foreground')}>
                        {nextOccurrenceSummary(row)}
                      </td>
                      <td className={cn(OpusTd, 'max-w-[12rem] truncate text-muted-foreground')}>
                        {scheduleSummaryForClass(row)}
                      </td>
                      <td className={OpusTd}>{enrollmentSummary(row)}</td>
                      <td className={OpusTd}>{classPriceLabel(row)}</td>
                      <td className={OpusTd}>
                        <Pill tone={active ? 'success' : 'neutral'} dot={false}>
                          {active ? 'Active' : 'Inactive'}
                        </Pill>
                      </td>
                      <td className={cn(OpusTd, 'text-right')}>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-[2.125rem]"
                                aria-label={`Actions for ${row.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem render={<Link href={detailHref(row.id)}>Open editor</Link>} />
                          </DropdownMenuContent>
                        </DropdownMenu>
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
