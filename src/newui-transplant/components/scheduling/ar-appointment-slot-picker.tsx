'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, ChevronDown, Loader2 } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function dayLabel(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ArAppointmentSlotPicker({
  slots,
  loading,
  selected,
  onSelect,
  error,
}: {
  slots: Array<{ startsAt: string }>
  loading: boolean
  selected: string
  onSelect: (startsAt: string) => void
  error?: string
}) {
  const [showAll, setShowAll] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, Array<{ startsAt: string }>>()
    for (const s of slots) {
      const k = dayKey(s.startsAt)
      const arr = map.get(k) || []
      arr.push(s)
      map.set(k, arr)
    }
    return Array.from(map.entries())
  }, [slots])

  const visible = showAll ? grouped : grouped.slice(0, 3)

  if (loading) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Loading available times…
        </p>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-4">
        <p className="text-sm font-medium text-destructive">{error}</p>
      </div>
    )
  }

  if (slots.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center">
        <CalendarClock className="mx-auto size-6 text-muted-foreground/60" aria-hidden />
        <p className="mt-2 text-sm font-semibold">No open times in the next 14 days</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try a different appointment type or adjust availability.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visible.map(([key, daySlots]) => (
        <div key={key}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {dayLabel(daySlots[0].startsAt)}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {daySlots.map((s) => {
              const active = selected === s.startsAt
              return (
                <Button
                  key={s.startsAt}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  className={cn('h-9 tabular-nums', active && 'ring-2 ring-primary/30')}
                  aria-pressed={active}
                  onClick={() => onSelect(s.startsAt)}
                >
                  {timeLabel(s.startsAt)}
                </Button>
              )
            })}
          </div>
        </div>
      ))}
      {grouped.length > 3 ? (
        <Button type="button" variant="link" className="h-auto p-0" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer days' : `Show ${grouped.length - 3} more days`}
          <ChevronDown className={cn('ml-1 size-3.5', showAll && 'rotate-180')} aria-hidden />
        </Button>
      ) : null}
    </div>
  )
}
