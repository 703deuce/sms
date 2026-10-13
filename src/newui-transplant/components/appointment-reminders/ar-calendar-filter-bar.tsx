'use client'

import { useRef, useState } from 'react'
import { Plus, Search, SlidersHorizontal } from 'lucide-react'
import type { CalendarFilters } from '@/components/appointments/calendar/calendar-filter-bar'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { cn } from '@/lib/utils'

export type { CalendarFilters }

type Workspace = {
  staff: Array<{ id: string; name: string }>
  locations: Array<{ id: string; name: string }>
  resources: Array<{ id: string; name: string }>
  services: Array<{ id: string; name: string }>
  timezone?: string
}

type Props = {
  workspace: Workspace | null
  filters: CalendarFilters
  onChange: (next: CalendarFilters) => void
  collapsed?: boolean
  onSearchSubmit?: () => void
  onWaitlist?: () => void
  onAdd?: () => void
  secondaryFiltersOpen?: boolean
  onToggleSecondaryFilters?: () => void
}

function activeSecondaryCount(filters: CalendarFilters) {
  let n = 0
  if (filters.locationId) n += 1
  if (filters.resourceId) n += 1
  if (filters.status !== 'all') n += 1
  return n
}

export function ArCalendarFilterBar({
  workspace,
  filters,
  onChange,
  collapsed,
  onSearchSubmit,
  onWaitlist,
  onAdd,
  secondaryFiltersOpen,
  onToggleSecondaryFilters,
}: Props) {
  const popRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const secondaryCount = activeSecondaryCount(filters)
  const secondaryOpen = secondaryFiltersOpen ?? open

  if (collapsed) return null

  const staffOptions = [
    { value: '', label: 'All staff' },
    ...(workspace?.staff || []).map((s) => ({ value: s.id, label: s.name })),
  ]

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm md:px-4"
      role="search"
    >
      <div className="relative min-w-[160px] flex-1 max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className="h-9 pl-9"
          placeholder="Search client, service…"
          value={filters.q}
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSearchSubmit?.()
          }}
          aria-label="Search calendar"
        />
      </div>

      <SimpleSelect
        className="h-9 min-w-[8rem]"
        label="Booking type"
        value={filters.domainType}
        onChange={(v) => onChange({ ...filters, domainType: v })}
        options={[
          { value: 'all', label: 'All types' },
          { value: 'service', label: 'Services' },
          { value: 'meeting', label: 'Meetings' },
          { value: 'class', label: 'Classes' },
        ]}
      />

      <SimpleSelect
        className="h-9 min-w-[8rem]"
        label="Staff"
        value={filters.staffIds[0] || ''}
        onChange={(v) => onChange({ ...filters, staffIds: v ? [v] : [] })}
        options={staffOptions}
      />

      <div className="relative" ref={popRef}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 gap-1.5"
          onClick={() => {
            onToggleSecondaryFilters?.()
            setOpen((v) => !v)
          }}
          aria-expanded={secondaryOpen}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filters
          {secondaryCount > 0 ? (
            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
              {secondaryCount}
            </span>
          ) : null}
        </Button>
        {secondaryOpen ? (
          <div
            className="absolute right-0 z-20 mt-1 w-72 rounded-lg border border-border bg-popover p-3 shadow-md"
            role="group"
            aria-label="More calendar filters"
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Location</label>
                <SimpleSelect
                  className="mt-1 h-9 w-full"
                  label="Location"
                  value={filters.locationId}
                  onChange={(v) => onChange({ ...filters, locationId: v })}
                  options={[
                    { value: '', label: 'Any location' },
                    ...(workspace?.locations || []).map((l) => ({ value: l.id, label: l.name })),
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Resource</label>
                <SimpleSelect
                  className="mt-1 h-9 w-full"
                  label="Resource"
                  value={filters.resourceId}
                  onChange={(v) => onChange({ ...filters, resourceId: v })}
                  options={[
                    { value: '', label: 'Any resource' },
                    ...(workspace?.resources || []).map((r) => ({ value: r.id, label: r.name })),
                  ]}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <SimpleSelect
                  className="mt-1 h-9 w-full"
                  label="Status"
                  value={filters.status}
                  onChange={(v) => onChange({ ...filters, status: v })}
                  options={[
                    { value: 'all', label: 'Any status' },
                    { value: 'scheduled', label: 'Scheduled' },
                    { value: 'confirmed', label: 'Confirmed' },
                    { value: 'completed', label: 'Completed' },
                    { value: 'canceled', label: 'Canceled' },
                  ]}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {onWaitlist ? (
        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onWaitlist}>
          Waitlist
        </Button>
      ) : null}

      {onAdd ? (
        <Button type="button" size="sm" className="h-9 gap-1.5" onClick={onAdd}>
          <Plus className="size-4" aria-hidden />
          New
        </Button>
      ) : null}
    </div>
  )
}
