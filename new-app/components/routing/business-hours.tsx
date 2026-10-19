'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Panel } from '@/components/app/page-primitives'
import { fetchBusinessHours } from '@/lib/phone-api'

type DayHours = { open?: string; close?: string; closed?: boolean }

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
}

function to12(t: string) {
  const [h, m] = t.split(':').map(Number)
  const suffix = h >= 12 ? 'pm' : 'am'
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''}${suffix}`
}

function formatTimezone(tz: string) {
  try {
    return Intl.DateTimeFormat(undefined, { timeZone: tz, timeZoneName: 'short' }).formatToParts(new Date()).find((p) => p.type === 'timeZoneName')?.value || tz
  } catch {
    return tz
  }
}

export function BusinessHours() {
  const [timezone, setTimezone] = useState<string | null>(null)
  const [hours, setHours] = useState<Record<string, DayHours> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void fetchBusinessHours()
      .then((data) => {
        setTimezone(data.timezone)
        setHours((data.hours as Record<string, DayHours>) || null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load hours'))
  }, [])

  const rows = DAY_ORDER.map((key) => {
    const h = hours?.[key] ?? hours?.[key.toUpperCase()]
    return { key, label: DAY_LABEL[key], hours: h }
  })

  return (
    <Panel
      title="Business hours"
      description={
        timezone
          ? `${formatTimezone(timezone)} · same schedule Phone routing uses`
          : 'Loading schedule…'
      }
      actions={
        <Link href="/app/settings?tab=business" className="text-xs font-medium text-primary hover:underline">
          Edit
        </Link>
      }
    >
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && !hours && <p className="text-sm text-muted-foreground">No business hours saved yet. Edit in Settings to control after-hours routing.</p>}
      {hours && (
        <dl className="grid grid-cols-[3rem_1fr] gap-y-1.5 text-sm">
          {rows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="tabular">
                {!row.hours || row.hours.closed ? (
                  <span className="text-muted-foreground">Closed</span>
                ) : row.hours.open && row.hours.close ? (
                  `${to12(row.hours.open)} – ${to12(row.hours.close)}`
                ) : (
                  <span className="text-muted-foreground">Open</span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  )
}
