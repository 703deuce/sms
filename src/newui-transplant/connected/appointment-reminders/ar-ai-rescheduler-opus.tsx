'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import type { AiReschedulerConfig, AiReschedulerMode } from '@/lib/appointment-reminders/ai-rescheduler/types'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

const DAYS = [
  ['monday', 'Monday'],
  ['tuesday', 'Tuesday'],
  ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'],
  ['friday', 'Friday'],
  ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
] as const

export function ArAiReschedulerOpusPage() {
  const [config, setConfig] = useState<AiReschedulerConfig | null>(null)
  const [timezone, setTimezone] = useState('America/New_York')
  const [calendar, setCalendar] = useState<{ provider: string; label: string; status: string } | null>(null)
  const [readiness, setReadiness] = useState<{
    level: number
    summary: string
    writeCalendarOk: boolean
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/appointment-reminders/ai-rescheduler')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load')
        return r.json()
      })
      .then((json) => {
        setConfig(json.data)
        setTimezone(json.timezone || 'America/New_York')
        setCalendar(json.calendar)
        setReadiness(json.readiness ?? null)
        setSaved(true)
      })
      .catch(() => setError('Could not load AI Rescheduler settings.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const patch = (partial: Partial<AiReschedulerConfig>) => {
    if (!config) return
    setConfig({ ...config, ...partial })
    setSaved(false)
  }

  const save = async () => {
    if (!config) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (!res.ok) throw new Error('Save failed')
      const json = await res.json()
      setConfig(json.data)
      setSaved(true)
    } catch {
      setError('Could not save settings. Try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  if (!config) {
    return <p className="text-destructive">{error || 'Settings unavailable.'}</p>
  }

  const aiOn = config.mode === 'ai'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-16">
      <header className="space-y-2 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">AI Rescheduler</h1>
          <Pill tone={aiOn ? 'success' : 'neutral'}>{aiOn ? 'AI enabled' : 'Notify only'}</Pill>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Let customers confirm, reschedule, or cancel appointments by replying to their reminder texts.
          Changes sync with your connected Google or Microsoft calendar.
        </p>
      </header>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <section className="space-y-4">
        <h2 className="text-base font-medium">How should rescheduling work?</h2>
        <div className="grid gap-3">
          {(
            [
              {
                mode: 'notify' as AiReschedulerMode,
                title: 'Notify me',
                desc: 'Collect the customer’s request and notify your business. You handle the calendar change.',
              },
              {
                mode: 'ai' as AiReschedulerMode,
                title: 'AI reschedules',
                desc: 'AI checks your connected calendar, offers available times, and updates the original appointment after confirmation.',
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.mode}
              type="button"
              onClick={() => patch({ mode: opt.mode })}
              className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                config.mode === opt.mode
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="font-medium">{opt.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{opt.desc}</div>
            </button>
          ))}
        </div>
      </section>

      {aiOn ? (
        <>
          <section className="space-y-3 border-t border-border/60 pt-6">
            <h2 className="text-base font-medium">Approval</h2>
            <SimpleSelect
              label="After the customer chooses a time"
              value={config.approval}
              onChange={(v) => patch({ approval: v as AiReschedulerConfig['approval'] })}
              options={[
                { value: 'automatic', label: 'Automatic after customer confirmation' },
                { value: 'business', label: 'Require business approval' },
              ]}
            />
          </section>

          <section className="space-y-3 border-t border-border/60 pt-6">
            <h2 className="text-base font-medium">When can customers reschedule?</h2>
            <p className="text-xs text-muted-foreground">Timezone: {timezone}</p>
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {DAYS.map(([key, label]) => {
                const day = config.weeklyHours[key] || { enabled: false, open: '09:00', close: '17:00' }
                return (
                  <li key={key} className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm">
                    <label className="flex min-w-[7rem] items-center gap-2">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) =>
                          patch({
                            weeklyHours: {
                              ...config.weeklyHours,
                              [key]: { ...day, enabled: e.target.checked },
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                    {day.enabled ? (
                      <>
                        <Input
                          className="h-8 w-24"
                          value={day.open}
                          onChange={(e) =>
                            patch({
                              weeklyHours: {
                                ...config.weeklyHours,
                                [key]: { ...day, open: e.target.value },
                              },
                            })
                          }
                          aria-label={`${label} start`}
                        />
                        <span className="text-muted-foreground">to</span>
                        <Input
                          className="h-8 w-24"
                          value={day.close}
                          onChange={(e) =>
                            patch({
                              weeklyHours: {
                                ...config.weeklyHours,
                                [key]: { ...day, close: e.target.value },
                              },
                            })
                          }
                          aria-label={`${label} end`}
                        />
                      </>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>

          <section className="space-y-3 border-t border-border/60 pt-6">
            <h2 className="text-base font-medium">Appointment duration</h2>
            <SimpleSelect
              label="Duration"
              value={config.durationMode}
              onChange={(v) => patch({ durationMode: v as AiReschedulerConfig['durationMode'] })}
              options={[
                { value: 'original', label: 'Keep original appointment duration' },
                { value: 'fixed', label: 'Use a fixed duration' },
              ]}
            />
            {config.durationMode === 'fixed' ? (
              <Input
                type="number"
                min={5}
                max={480}
                value={config.fixedDurationMinutes ?? 30}
                onChange={(e) => patch({ fixedDurationMinutes: Number(e.target.value) })}
                aria-label="Fixed duration in minutes"
              />
            ) : null}
          </section>

          <section className="space-y-3 border-t border-border/60 pt-6">
            <h2 className="text-base font-medium">Rescheduling rules</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">
                Minimum notice (minutes)
                <Input
                  type="number"
                  className="mt-1"
                  value={config.minimumNoticeMinutes}
                  onChange={(e) => patch({ minimumNoticeMinutes: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                Max days ahead
                <Input
                  type="number"
                  className="mt-1"
                  value={config.maximumDaysAhead}
                  onChange={(e) => patch({ maximumDaysAhead: Number(e.target.value) })}
                />
              </label>
              <label className="text-sm">
                Buffer (minutes)
                <Input
                  type="number"
                  className="mt-1"
                  value={config.bufferMinutes}
                  onChange={(e) => patch({ bufferMinutes: Number(e.target.value) })}
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={config.allowProviderCancel}
                onChange={(e) => patch({ allowProviderCancel: e.target.checked })}
              />
              Allow SMS cancel to update the connected calendar (X)
            </label>
          </section>
        </>
      ) : null}

      <section className="space-y-2 border-t border-border/60 pt-6">
        <h2 className="text-base font-medium">Connected calendar</h2>
        {calendar ? (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              {calendar.label} ({calendar.provider}) — {calendar.status}
            </p>
            {readiness ? (
              <p>
                Readiness: level {readiness.level}/3 — {readiness.summary}
                {aiOn && config.approval === 'automatic' && !readiness.writeCalendarOk ? (
                  <span className="block text-amber-700 dark:text-amber-400">
                    Automatic calendar updates need write access and a write calendar selected.
                  </span>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No calendar connected. Connect one under Calendars.</p>
        )}
      </section>

      <Panel className="space-y-2 text-sm text-muted-foreground">
        <h2 className="text-base font-medium text-foreground">What your customers will see</h2>
        <p>
          “Hi Sarah, your appointment with ABC Dental is Wednesday, October 14 at 2:00 PM. Reply C to confirm, R
          to reschedule, or X to cancel.”
        </p>
        <p className="text-xs">Live times are provider-verified; preview is illustrative only.</p>
      </Panel>

      <div className="flex items-center gap-3 border-t border-border/60 pt-6">
        <Button onClick={() => void save()} disabled={saving || saved}>
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
        </Button>
        {!saved ? <span className="text-sm text-muted-foreground">Unsaved changes</span> : null}
      </div>
    </div>
  )
}
