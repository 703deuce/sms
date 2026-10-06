'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Clock } from 'lucide-react'
import { ConfigSection, SettingRow } from '@/newui-transplant/components/app/kit'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { MctbWeeklyScheduleEditor } from '@/newui-transplant/components/mctb/mctb-weekly-schedule-editor'
import {
  defaultWeeklySchedule,
  type MctbWeeklySchedule,
} from '@/lib/mctb/schedule-shared'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

function formatHoursSummary(schedule: MctbWeeklySchedule): string {
  const open = schedule.days.filter((d) => d.enabled)
  if (open.length === 0) return 'No open days configured'
  const sample = open[0]
  const sameHours = open.every(
    (d) => d.startTime === sample?.startTime && d.endTime === sample?.endTime,
  )
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = open.map((d) => dayLabels[d.day]).join(', ')
  if (sameHours && sample) {
    return `${days} · ${sample.startTime}–${sample.endTime} (${schedule.timezone})`
  }
  return `${open.length} open day(s) · ${schedule.timezone}`
}

export function MctbMessagingHoursPanel({
  initialWeeklySchedule,
  timezone,
  onSaved,
}: {
  initialWeeklySchedule: MctbWeeklySchedule | null
  timezone: string
  onSaved?: () => void
}) {
  const [schedule, setSchedule] = useState<MctbWeeklySchedule>(
    initialWeeklySchedule ?? defaultWeeklySchedule(timezone),
  )
  const [expanded, setExpanded] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (initialWeeklySchedule) setSchedule(initialWeeklySchedule)
  }, [initialWeeklySchedule])

  const summary = useMemo(() => formatHoursSummary(schedule), [schedule])

  const onSave = async () => {
    setSaveError(null)
    try {
      await saveMctbSetup({
        scheduleMode: 'custom',
        weeklySchedule: {
          timezone: schedule.timezone,
          days: schedule.days,
        },
      })
      await onSaved?.()
      setExpanded(false)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Could not save business hours')
      throw e
    }
  }

  return (
    <ConfigSection
      icon={Clock}
      title="Business hours for messaging"
      description="These hours determine whether callers receive your during-hours or after-hours missed-call text. Forwarding is unchanged."
      insetClassName="space-y-4"
    >
      <p className="text-sm text-foreground">{summary}</p>
      <p className="text-xs text-muted-foreground">
        Transovo picks the correct message automatically based on when the missed call happens.
      </p>
      {!expanded ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={() => setExpanded(true)}
          >
            Edit hours
          </button>
          <span className="text-muted-foreground">·</span>
          <Link href="/settings/business" className="text-sm text-muted-foreground hover:text-primary hover:underline">
            Business profile
          </Link>
        </div>
      ) : (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <SettingRow
            title="Timezone"
            description="Used to decide open vs closed for messaging"
            control={
              <SimpleSelect
                label="Timezone"
                className="w-56"
                value={schedule.timezone}
                options={[{ value: schedule.timezone, label: schedule.timezone }]}
                onChange={() => undefined}
                disabled
              />
            }
          />
          <MctbWeeklyScheduleEditor schedule={schedule} onChange={setSchedule} />
          {saveError ? (
            <p className="text-sm text-destructive" role="alert">{saveError}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="text-sm text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(false)}
            >
              Cancel
            </button>
            <SaveBar label="Save hours" onSave={onSave} />
          </div>
        </div>
      )}
    </ConfigSection>
  )
}
