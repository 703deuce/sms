'use client'

import { Input } from '@/newui-transplant/components/ui/input'
import { Label } from '@/newui-transplant/components/ui/label'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import type { MctbWeeklyDay, MctbWeeklySchedule } from '@/lib/mctb/schedule-shared'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type Props = {
  schedule: MctbWeeklySchedule
  onChange: (schedule: MctbWeeklySchedule) => void
}

/** Opus weekly schedule editor — same behavior as legacy editor, no @/components/mctb import. */
export function MctbWeeklyScheduleEditor({ schedule, onChange }: Props) {
  function updateDay(day: number, patch: Partial<MctbWeeklyDay>) {
    onChange({
      ...schedule,
      days: schedule.days.map((d) => (d.day === day ? { ...d, ...patch } : d)),
    })
  }

  function toggleDay(day: number) {
    const row = schedule.days.find((d) => d.day === day)
    if (!row) return
    updateDay(day, { enabled: !row.enabled })
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="mctb-weekly-schedule-tz">Timezone</Label>
        <Input
          id="mctb-weekly-schedule-tz"
          className="mt-1 max-w-xs"
          value={schedule.timezone}
          onChange={(e) => onChange({ ...schedule, timezone: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        {DAY_LABELS.map((label, day) => {
          const row = schedule.days.find((d) => d.day === day)
          if (!row) return null
          return (
            <div
              key={day}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm"
            >
              <label className="flex items-center gap-2 font-medium">
                <Checkbox checked={row.enabled} onCheckedChange={() => toggleDay(day)} />
                {label}
              </label>
              {row.enabled ? (
                <>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={row.startTime}
                    onChange={(e) => updateDay(day, { startTime: e.target.value })}
                    aria-label={`${label} start time`}
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="time"
                    className="h-9 w-[120px]"
                    value={row.endTime}
                    onChange={(e) => updateDay(day, { endTime: e.target.value })}
                    aria-label={`${label} end time`}
                  />
                </>
              ) : (
                <span className="text-muted-foreground">Inactive</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
