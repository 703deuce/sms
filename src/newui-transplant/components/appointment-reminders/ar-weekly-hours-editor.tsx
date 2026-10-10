'use client'

import { Panel } from '@/newui-transplant/components/app/kit'
import { Input } from '@/newui-transplant/components/ui/input'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'

const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export type WeeklyHoursMap = Record<string, Array<{ open: string; close: string }>>

type Props = {
  timezone: string
  weeklyHours: WeeklyHoursMap
  onChange: (next: WeeklyHoursMap) => void
  onTimezoneChange?: (tz: string) => void
}

function defaultDayWindows(): WeeklyHoursMap {
  const map: WeeklyHoursMap = {}
  for (const day of DAY_KEYS) {
    map[day] = day === 'sunday' ? [] : [{ open: '09:00', close: '17:00' }]
  }
  return map
}

export function normalizeWeeklyHours(input?: WeeklyHoursMap): WeeklyHoursMap {
  const base = defaultDayWindows()
  if (!input) return base
  for (const day of DAY_KEYS) {
    if (input[day]) base[day] = input[day]
  }
  return base
}

export function ArWeeklyHoursEditor({ timezone, weeklyHours, onChange, onTimezoneChange }: Props) {
  const hours = normalizeWeeklyHours(weeklyHours)

  const setDay = (day: string, windows: Array<{ open: string; close: string }>) => {
    onChange({ ...hours, [day]: windows })
  }

  return (
    <Panel
      title="Business hours"
      description="Reminders can skip sends outside these hours when per-step rules request it. Blocked sends are skipped — not delayed."
    >
      {onTimezoneChange ? (
        <label className="mb-4 block text-sm">
          <span className="mb-1.5 block font-medium">Timezone</span>
          <Input className="h-10 max-w-xs" value={timezone} onChange={(e) => onTimezoneChange(e.target.value)} />
        </label>
      ) : (
        <p className="mb-4 text-sm text-muted-foreground">Timezone: {timezone}</p>
      )}
      <div className="space-y-2">
        {DAY_KEYS.map((day, i) => {
          const open = (hours[day]?.length ?? 0) > 0
          const window = hours[day]?.[0] || { open: '09:00', close: '17:00' }
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <label className="flex min-w-[72px] items-center gap-2 font-medium">
                <Checkbox
                  checked={open}
                  onCheckedChange={(checked) =>
                    setDay(day, checked ? [{ open: window.open, close: window.close }] : [])
                  }
                />
                {DAY_LABELS[i]}
              </label>
              {open ? (
                <>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={window.open}
                    onChange={(e) => setDay(day, [{ open: e.target.value, close: window.close }])}
                    aria-label={`${DAY_LABELS[i]} opening time`}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={window.close}
                    onChange={(e) => setDay(day, [{ open: window.open, close: e.target.value }])}
                    aria-label={`${DAY_LABELS[i]} closing time`}
                  />
                </>
              ) : (
                <span className="text-muted-foreground">Closed</span>
              )}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
