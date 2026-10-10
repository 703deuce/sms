'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, Check, Loader2, Sparkles, UserRoundCog } from 'lucide-react'
import type {
  AiReschedulerConfig,
  AiReschedulerMode,
} from '@/lib/appointment-reminders/ai-rescheduler/types'
import type {
  ArSmsLateActionMode,
  ArSmsPenaltyType,
} from '@/lib/appointment-reminders/ai-rescheduler/ar-sms-action-policy'
import { OpusDataSurface } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { Panel, Pill } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { cn } from '@/lib/utils'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import type { ArSmsActionPolicyConfig } from '@/lib/appointment-reminders/ai-rescheduler/ar-sms-action-policy'

const LATE_MODE_OPTIONS: { value: ArSmsLateActionMode; label: string }[] = [
  { value: 'allow', label: 'Allow (no extra warning)' },
  { value: 'allow_with_warning', label: 'Allow with policy warning' },
  { value: 'contact_business', label: 'Contact business (no auto action)' },
]

const PENALTY_OPTIONS: { value: ArSmsPenaltyType; label: string }[] = [
  { value: 'none', label: 'No penalty text' },
  { value: 'lost_session', label: 'Lost prepaid session' },
  { value: 'percent_of_price', label: 'Percentage of price' },
  { value: 'fixed_fee', label: 'Fixed fee' },
  { value: 'nonrefundable_deposit', label: 'Nonrefundable deposit' },
  { value: 'custom_text', label: 'Custom policy text' },
]

function SmsActionPolicyFields(input: {
  title: string
  policy?: ArSmsActionPolicyConfig
  legacyCutoffMinutes?: number
  defaultAfterCutoff: ArSmsLateActionMode
  onChange: (policy: ArSmsActionPolicyConfig, legacyCutoff: number) => void
}) {
  const cutoff =
    input.policy?.cutoffMinutes ?? input.legacyCutoffMinutes ?? 0
  const afterCutoff = input.policy?.afterCutoff ?? input.defaultAfterCutoff
  const penaltyType = input.policy?.penaltyType ?? 'none'

  function merge(patch: Partial<ArSmsActionPolicyConfig>, legacy?: number) {
    const next: ArSmsActionPolicyConfig = {
      cutoffMinutes: legacy ?? cutoff,
      afterCutoff,
      penaltyType,
      penaltyPercent: input.policy?.penaltyPercent,
      penaltyFixedAmountCents: input.policy?.penaltyFixedAmountCents,
      penaltyCustomText: input.policy?.penaltyCustomText,
      ...patch,
    }
    input.onChange(next, next.cutoffMinutes ?? 0)
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 p-3">
      <h3 className="text-sm font-medium">{input.title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Cutoff (minutes before appointment)
          <Input
            type="number"
            min={0}
            className="mt-1"
            value={cutoff}
            onChange={(e) => merge({ cutoffMinutes: Math.max(0, Number(e.target.value)) })}
          />
        </label>
        <SimpleSelect
          label="After cutoff"
          value={afterCutoff}
          onChange={(v) => merge({ afterCutoff: v as ArSmsLateActionMode })}
          options={LATE_MODE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
        />
        {afterCutoff === 'allow_with_warning' ? (
          <>
            <SimpleSelect
              label="Late-action consequence"
              value={penaltyType}
              onChange={(v) => merge({ penaltyType: v as ArSmsPenaltyType })}
              options={PENALTY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
            {penaltyType === 'percent_of_price' ? (
              <label className="text-sm">
                Percent
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="mt-1"
                  value={input.policy?.penaltyPercent ?? 50}
                  onChange={(e) => merge({ penaltyPercent: Number(e.target.value) })}
                />
              </label>
            ) : null}
            {penaltyType === 'fixed_fee' ? (
              <label className="text-sm">
                Fee (cents)
                <Input
                  type="number"
                  min={0}
                  className="mt-1"
                  value={input.policy?.penaltyFixedAmountCents ?? 2500}
                  onChange={(e) =>
                    merge({ penaltyFixedAmountCents: Number(e.target.value) })
                  }
                />
              </label>
            ) : null}
            {penaltyType === 'custom_text' ? (
              <label className="text-sm sm:col-span-2">
                Custom policy text
                <Input
                  className="mt-1"
                  value={input.policy?.penaltyCustomText ?? ''}
                  onChange={(e) => merge({ penaltyCustomText: e.target.value })}
                />
              </label>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function ArReschedulerOperationsPanel() {
  const [ops, setOps] = useState<{
    pendingApproval: Array<{ appointmentId: string; serviceName: string | null; startsAt: string; requestStatus: string; contactName?: string }>
    reconcilePending: Array<{ appointmentId: string; serviceName: string | null; proposedStartsAt?: string }>
  } | null>(null)
  const [opsError, setOpsError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/appointment-reminders/ai-rescheduler/operations')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('ops'))))
      .then((json) => setOps(json.data))
      .catch(() => setOpsError('Could not load pending reschedule operations.'))
  }, [])

  async function approve(appointmentId: string) {
    setBusy(appointmentId)
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (!res.ok) throw new Error('approve_failed')
      const refresh = await fetch('/api/appointment-reminders/ai-rescheduler/operations')
      if (refresh.ok) {
        const json = await refresh.json()
        setOps(json.data)
      }
    } catch {
      setOpsError('Approve failed. Check calendar availability and try again from Appointments.')
    } finally {
      setBusy(null)
    }
  }

  async function reject(appointmentId: string) {
    setBusy(appointmentId)
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (!res.ok) throw new Error('reject_failed')
      const refresh = await fetch('/api/appointment-reminders/ai-rescheduler/operations')
      if (refresh.ok) {
        const json = await refresh.json()
        setOps(json.data)
      }
    } catch {
      setOpsError('Reject failed.')
    } finally {
      setBusy(null)
    }
  }

  async function reconcile(appointmentId: string) {
    setBusy(`reconcile:${appointmentId}`)
    try {
      const res = await fetch('/api/appointment-reminders/ai-rescheduler/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      })
      if (!res.ok) throw new Error('reconcile_failed')
      const refresh = await fetch('/api/appointment-reminders/ai-rescheduler/operations')
      if (refresh.ok) {
        const json = await refresh.json()
        setOps(json.data)
      }
    } catch {
      setOpsError('Reconcile failed — calendar may not match the proposed time yet.')
    } finally {
      setBusy(null)
    }
  }

  if (!ops && !opsError) return null
  const pending = ops?.pendingApproval || []
  const reconcilePending = ops?.reconcilePending || []
  if (!opsError && !pending.length && !reconcilePending.length) return null

  return (
    <section className="space-y-4 border-t border-border/60 pt-6">
      <h2 className="text-base font-medium">Pending operations</h2>
      {opsError ? <p className="text-sm text-destructive">{opsError}</p> : null}
      {pending.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Staff approval</h3>
          <ul className="space-y-2 text-sm">
            {pending.map((p) => (
              <li key={p.appointmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>
                  {p.serviceName || 'Appointment'} — {p.contactName || 'Customer'} ({p.requestStatus})
                </span>
                <span className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" disabled={busy === p.appointmentId} onClick={() => void reject(p.appointmentId)}>
                    Reject
                  </Button>
                  <Button type="button" size="sm" disabled={busy === p.appointmentId} onClick={() => void approve(p.appointmentId)}>
                    Approve
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {reconcilePending.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Calendar reconciliation</h3>
          <ul className="space-y-2 text-sm">
            {reconcilePending.map((p) => (
              <li key={p.appointmentId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <span>{p.serviceName || 'Appointment'} — provider sync pending</span>
                <Button type="button" size="sm" variant="outline" disabled={busy === `reconcile:${p.appointmentId}`} onClick={() => void reconcile(p.appointmentId)}>
                  Reconcile
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

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
  const modePill =
    config.mode === 'ai'
      ? { tone: 'success' as const, label: 'AI handles changes' }
      : config.mode === 'notify'
        ? { tone: 'primary' as const, label: 'Notify staff' }
        : { tone: 'neutral' as const, label: 'Reminders only' }

  const handlingLevels: Array<{
    mode: AiReschedulerMode
    title: string
    desc: string
    icon: typeof Bell
  }> = [
    {
      mode: 'reminders_only',
      title: 'Reminders only',
      desc:
        'Send the reminder text only — no “reply C to confirm” or cancel/reschedule instructions appended. Customers get your template as written.',
      icon: Bell,
    },
    {
      mode: 'notify',
      title: 'Notify staff',
      desc:
        'Include confirm / cancel / reschedule replies on SMS. When customers request a change, your team gets notified to handle the calendar.',
      icon: UserRoundCog,
    },
    {
      mode: 'ai',
      title: 'AI handles supported changes',
      desc:
        'Same reply options as notify mode, but AI offers times from your calendar and updates the appointment per your approval rules below.',
      icon: Sparkles,
    },
  ]

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 pb-16">
      <header className="space-y-2 border-b border-border/60 pb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">AI Rescheduler</h1>
          <Pill tone={modePill.tone}>{modePill.label}</Pill>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Choose how Transovo handles appointment changes when customers reply to reminders or use email action
          links. Reminders-only keeps outbound messages without change handling; notify and AI modes build on
          your existing calendar connection.
        </p>
      </header>

      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}

      <OpusDataSurface
        className="bg-gradient-to-br from-card via-card to-primary/[0.04]"
        toolbar={
          <div>
            <h2 className="text-base font-semibold tracking-tight">Handling level</h2>
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
              Choose what happens when customers reply to reminders or use email action links. This uses your
              existing AI Rescheduler configuration — no separate mode system.
            </p>
          </div>
        }
      >
        <div className="grid gap-3 p-4 sm:grid-cols-1 lg:grid-cols-3">
          {handlingLevels.map((level) => {
            const Icon = level.icon
            const selected = config.mode === level.mode
            const cardClass = cn(
              OPUS_CARD,
              'relative flex h-full flex-col gap-3 p-4 text-left transition-all',
              selected
                ? 'border-primary/60 bg-primary/[0.06] ring-2 ring-primary/25 shadow-sm'
                : 'hover:border-primary/30 hover:bg-muted/30',
            )
            const inner = (
              <>
                {selected ? (
                  <span
                    className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground"
                    aria-hidden="true"
                  >
                    <Check className="size-3.5" />
                  </span>
                ) : null}
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-xl',
                    selected ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                  aria-hidden="true"
                >
                  <Icon className="size-5" />
                </span>
                <div>
                  <div className="font-semibold">{level.title}</div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{level.desc}</p>
                </div>
              </>
            )
            return (
              <button
                key={level.mode}
                type="button"
                onClick={() => patch({ mode: level.mode })}
                className={cardClass}
                aria-pressed={selected}
              >
                {inner}
              </button>
            )
          })}
        </div>
      </OpusDataSurface>

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
            <SmsActionPolicyFields
              title="SMS rescheduling (reply R)"
              defaultAfterCutoff="contact_business"
              policy={config.rescheduleSmsPolicy}
              legacyCutoffMinutes={config.rescheduleSmsCutoffMinutes}
              onChange={(policy, legacyCutoff) =>
                patch({
                  rescheduleSmsPolicy: policy,
                  rescheduleSmsCutoffMinutes: legacyCutoff,
                })
              }
            />
            <SmsActionPolicyFields
              title="SMS cancellation (reply X)"
              defaultAfterCutoff="allow"
              policy={config.cancelSmsPolicy}
              legacyCutoffMinutes={config.cancelSmsCutoffMinutes}
              onChange={(policy, legacyCutoff) =>
                patch({
                  cancelSmsPolicy: policy,
                  cancelSmsCutoffMinutes: legacyCutoff,
                })
              }
            />
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

      <ArReschedulerOperationsPanel />

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
