'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel } from '@/components/app/page-primitives'
import { fetchBusinessHours } from '@/lib/phone-api'

type DayHours = { open?: string; close?: string; closed?: boolean }

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const DEFAULT_HOURS: Record<string, DayHours> = {
  mon: { open: '09:00', close: '17:00' },
  tue: { open: '09:00', close: '17:00' },
  wed: { open: '09:00', close: '17:00' },
  thu: { open: '09:00', close: '17:00' },
  fri: { open: '09:00', close: '17:00' },
  sat: { closed: true },
  sun: { closed: true },
}

export function BusinessHoursEditor() {
  const [timezone, setTimezone] = useState('America/Chicago')
  const [hours, setHours] = useState<Record<string, DayHours>>(DEFAULT_HOURS)
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchBusinessHours()
      .then((data) => {
        setTimezone(data.timezone || 'America/Chicago')
        if (data.hours && typeof data.hours === 'object') {
          setHours({ ...DEFAULT_HOURS, ...(data.hours as Record<string, DayHours>) })
        }
      })
      .catch(() => toast.error('Could not load business hours'))
      .finally(() => setLoading(false))
  }, [])

  const save = () => {
    void (async () => {
      const { saveRouting } = await import('@/lib/phone-api')
      await saveRouting({ timezone, businessHoursJson: hours })
      setDirty(false)
      toast.success('Business hours saved', { description: 'Phone routing uses this schedule immediately.' })
    })().catch((e) => toast.error(e instanceof Error ? e.message : 'Could not save hours'))
  }

  return (
    <Panel title="Business hours" description="Controls after-hours routing and open/closed detection for Phone.">
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="tz">Timezone</Label>
            <Input
              id="tz"
              value={timezone}
              onChange={(e) => {
                setDirty(true)
                setTimezone(e.target.value)
              }}
              placeholder="America/Chicago"
              className="font-mono text-sm"
            />
          </div>
          <ul className="flex flex-col gap-2">
            {DAY_KEYS.map((key) => {
              const day = hours[key] || { closed: true }
              return (
                <li key={key} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
                  <span className="text-sm font-medium">{DAY_LABEL[key]}</span>
                  <Input
                    type="time"
                    value={day.closed ? '' : day.open || ''}
                    disabled={day.closed}
                    onChange={(e) => {
                      setDirty(true)
                      setHours((h) => ({ ...h, [key]: { ...day, open: e.target.value, closed: false } }))
                    }}
                    aria-label={`${DAY_LABEL[key]} open`}
                  />
                  <Input
                    type="time"
                    value={day.closed ? '' : day.close || ''}
                    disabled={day.closed}
                    onChange={(e) => {
                      setDirty(true)
                      setHours((h) => ({ ...h, [key]: { ...day, close: e.target.value, closed: false } }))
                    }}
                    aria-label={`${DAY_LABEL[key]} close`}
                  />
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(day.closed)}
                      onChange={(e) => {
                        setDirty(true)
                        setHours((h) => ({
                          ...h,
                          [key]: e.target.checked ? { closed: true } : { open: '09:00', close: '17:00' },
                        }))
                      }}
                    />
                    Closed
                  </label>
                </li>
              )
            })}
          </ul>
          <Button size="sm" className="self-end" disabled={!dirty} onClick={save}>
            Save business hours
          </Button>
        </div>
      )}
    </Panel>
  )
}
