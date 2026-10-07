'use client'

import { CalendarCheck, Plus } from 'lucide-react'
import type { ReminderItem } from '@/features/appointments/kimi/reminders/types'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Switch } from '@/newui-transplant/components/ui/switch'
import { cn } from '@/lib/utils'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

function minutesToParts(minutes: number) {
  if (minutes >= 1440 && minutes % 1440 === 0) return { value: minutes / 1440, unit: 'days' as const }
  if (minutes >= 60 && minutes % 60 === 0) return { value: minutes / 60, unit: 'hours' as const }
  return { value: minutes, unit: 'minutes' as const }
}

function partsToMinutes(value: number, unit: 'minutes' | 'hours' | 'days') {
  if (unit === 'days') return value * 1440
  if (unit === 'hours') return value * 60
  return value
}

const UNIT_OPTIONS = [
  { value: 'minutes', label: 'minutes before' },
  { value: 'hours', label: 'hours before' },
  { value: 'days', label: 'days before' },
]

type Props = {
  steps: ReminderItem[]
  onToggle: (stepKey: string) => void
  onEdit: (step: ReminderItem) => void
  onAdd: () => void
  onMinutesChange: (stepKey: string, minutes: number) => void
}

export function ReminderSequenceTimeline({ steps, onToggle, onEdit, onAdd, onMinutesChange }: Props) {
  const activeCount = steps.filter((s) => s.enabled).length

  return (
    <div className="p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold tracking-tight">Reminder sequence</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            When an appointment is imported · {activeCount} active step{activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="h-9" onClick={onAdd}>
          <Plus className="mr-1.5 size-3.5" aria-hidden="true" />
          Add step
        </Button>
      </div>

      <ol className="space-y-0">
        {steps.map((step, index) => {
          const isConfirmation = step.stepKey === 'confirmation'
          const parts = !isConfirmation && step.minutesBefore != null
            ? minutesToParts(step.minutesBefore)
            : null

          return (
            <li key={step.stepKey} className="relative flex gap-3 pb-3">
              <div className="flex w-5 flex-col items-center pt-3" aria-hidden="true">
                <span
                  className={cn(
                    'size-2.5 rounded-full ring-2 ring-background',
                    step.enabled ? 'bg-primary' : 'bg-muted-foreground/35',
                  )}
                />
                {index < steps.length - 1 ? (
                  <span className="mt-1 w-px flex-1 bg-border" />
                ) : null}
              </div>

              <article
                className={cn(
                  OPUS_CARD,
                  'mb-1 flex min-h-[72px] flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center',
                  !step.enabled && 'border-dashed bg-muted/25 opacity-80',
                )}
              >
                <div className="min-w-0 flex-1 space-y-1">
                  {isConfirmation ? (
                    <p className="text-sm font-semibold tracking-tight">{step.badge}</p>
                  ) : parts ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        type="number"
                        min={1}
                        className="h-9 w-16 text-center tabular-nums"
                        value={parts.value}
                        onChange={(e) =>
                          onMinutesChange(
                            step.stepKey,
                            partsToMinutes(Number(e.target.value) || 1, parts.unit),
                          )
                        }
                        aria-label={`${step.title} timing amount`}
                      />
                      <SimpleSelect
                        label="Timing unit"
                        value={parts.unit}
                        onChange={(unit) =>
                          onMinutesChange(
                            step.stepKey,
                            partsToMinutes(parts.value, unit as 'minutes' | 'hours' | 'days'),
                          )
                        }
                        options={UNIT_OPTIONS}
                        className="w-[148px]"
                      />
                    </div>
                  ) : null}
                  <p className="text-sm font-medium text-foreground">{step.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {step.preview || step.template}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={step.enabled}
                      onCheckedChange={() => onToggle(step.stepKey)}
                      aria-label={`Enable ${step.title}`}
                    />
                    <span className="text-xs text-muted-foreground">{step.enabled ? 'On' : 'Off'}</span>
                  </div>
                  <Button type="button" variant="secondary" size="sm" className="h-8" onClick={() => onEdit(step)}>
                    Edit message
                  </Button>
                </div>
              </article>
            </li>
          )
        })}

        <li className="flex gap-3 pl-0.5">
          <span className="mt-1 size-2.5 rounded-full border border-dashed border-muted-foreground/50" aria-hidden="true" />
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onAdd}
          >
            + Add another reminder before the appointment
          </button>
        </li>
      </ol>

      <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarCheck className="size-4 shrink-0" aria-hidden="true" />
        <span className="font-medium text-foreground">Appointment start</span>
      </div>
    </div>
  )
}
