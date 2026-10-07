'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Plus } from 'lucide-react'
import {
  addAdditionalReminderStep,
  buildRemindersPageModel,
  patchReminderAdvanced,
  patchReminderChannel,
  patchReminderEnabled,
  patchReminderMinutesBefore,
  patchReminderTemplate,
  removeReminderStep,
  resetReminderTemplate,
  type RemindersApiConfig,
  type ReminderPreviewMap,
  REMINDER_MERGE_TAGS,
} from '@/features/appointments/kimi/reminders/map-reminders'
import { listReminderStepIds, resolveReminderStep } from '@/lib/appointments/reminders/reminders-config'
import { DEFAULT_PLATFORM_CONFIG, type AppointmentPlatformConfig, type ReminderChannel } from '@/lib/appointments/types'
import type { ReminderItem, ReminderStepKey } from '@/features/appointments/kimi/reminders/types'
import { Callout, Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { Input } from '@/newui-transplant/components/ui/input'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/newui-transplant/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'

function asPlatformConfig(config: RemindersApiConfig): AppointmentPlatformConfig {
  return { ...DEFAULT_PLATFORM_CONFIG, timezone: config.timezone, reminders: config.reminders }
}

async function loadPreviews(config: RemindersApiConfig): Promise<ReminderPreviewMap> {
  const keys = listReminderStepIds(asPlatformConfig(config))
  const entries = await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`/api/appointments/reminders/test?step=${encodeURIComponent(key)}`)
      if (!res.ok) return [key, ''] as const
      const json = await res.json()
      return [key, json.data?.preview || ''] as const
    }),
  )
  return Object.fromEntries(entries) as ReminderPreviewMap
}

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

export function AppointmentRemindersSettingsOpus() {
  const [config, setConfig] = useState<RemindersApiConfig | null>(null)
  const [previews, setPreviews] = useState<ReminderPreviewMap>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [editStep, setEditStep] = useState<ReminderItem | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testStep, setTestStep] = useState<ReminderStepKey>('confirmation')
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    fetch('/api/appointments/settings')
      .then((r) => {
        if (!r.ok) throw new Error('settings failed')
        return r.json()
      })
      .then(async (json) => {
        const data = json.data
        const nextConfig: RemindersApiConfig = {
          timezone: data.timezone,
          reminders: {
            confirmation: data.reminders.confirmation,
            reminder24h: data.reminders.reminder24h,
            reminder2h: data.reminders.reminder2h,
            additionalSteps: data.reminders.additionalSteps || [],
          },
        }
        setConfig(nextConfig)
        setPreviews(await loadPreviews(nextConfig))
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const model = useMemo(
    () => (config ? buildRemindersPageModel(config, previews) : null),
    [config, previews],
  )

  const save = useCallback(async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/appointments/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reminders: config.reminders, timezone: config.timezone }),
      })
      if (!res.ok) throw new Error('save failed')
      setSaved(true)
      setPreviews(await loadPreviews(config))
    } catch {
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }, [config])

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        Loading reminder settings…
      </p>
    )
  }

  if (failed || !model || !config) {
    return (
      <Callout tone="danger" icon={AlertTriangle} title="Could not load reminder settings">
        <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={load}>
          Try again
        </Button>
      </Callout>
    )
  }

  const stepOptions = model.reminders.map((r) => ({ value: r.stepKey, label: r.title }))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saved && !saving ? (
          <span className="text-xs text-muted-foreground" role="status">Saved</span>
        ) : null}
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Tabs defaultValue="sequence">
        <TabsList>
          <TabsTrigger value="sequence">Reminder sequence</TabsTrigger>
          <TabsTrigger value="test">Send test</TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="mt-4 space-y-4">
          <Panel
            title="Default sequence"
            description="SMS reminders for imported calendar appointments. Timing applies to future appointments only."
            bodyClassName="p-0"
          >
            <ul className="divide-y">
              {model.reminders.map((step) => (
                <li key={step.stepKey} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={step.enabled}
                      onChange={() => {
                        const s = resolveReminderStep(asPlatformConfig(config), step.stepKey)
                        if (!s) return
                        setConfig(patchReminderEnabled(config, step.stepKey, !step.enabled))
                        setSaved(false)
                      }}
                      aria-label={`Enable ${step.title}`}
                    />
                    <span className="font-medium">{step.badge}</span>
                  </label>
                  <span className="text-sm text-muted-foreground capitalize">{step.channel}</span>
                  {step.stepKey !== 'confirmation' && step.minutesBefore != null ? (
                    <TimingEditor
                      minutes={step.minutesBefore}
                      onChange={(m) => {
                        setConfig(patchReminderMinutesBefore(config, step.stepKey, m))
                        setSaved(false)
                      }}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">On booking</span>
                  )}
                  <Button variant="outline" size="sm" className="ml-auto" onClick={() => setEditStep(step)}>
                    Edit message
                  </Button>
                </li>
              ))}
            </ul>
            <div className="border-t px-5 py-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setConfig(addAdditionalReminderStep(config))
                  setSaved(false)
                }}
              >
                <Plus className="mr-1 size-3.5" aria-hidden="true" />
                Add reminder step
              </Button>
            </div>
          </Panel>

          <Callout tone="neutral" icon={AlertTriangle} title="Consent and compliance">
            Recipient consent and SMS sender registration are enforced at send time. Manage compliance in{' '}
            <Link href="/compliance" className="font-medium underline">Compliance</Link>
            {' '}and phone extraction rules in your calendar field mapping.
          </Callout>
        </TabsContent>

        <TabsContent value="test" className="mt-4">
          <Panel title="Send test reminder" description="Sends a single test SMS using your saved templates.">
            <div className="grid gap-4 sm:max-w-md">
              <SimpleSelect
                label="Reminder step"
                value={testStep}
                onChange={(v) => setTestStep(v as ReminderStepKey)}
                options={stepOptions}
              />
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Test phone</span>
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} autoComplete="tel" />
              </label>
              {testError ? <p className="text-xs text-destructive" role="alert">{testError}</p> : null}
              <Button
                disabled={testing || !testPhone.trim()}
                onClick={async () => {
                  setTesting(true)
                  setTestError('')
                  try {
                    const res = await fetch('/api/appointments/reminders/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ stepKey: testStep, phone: testPhone.trim() }),
                    })
                    const json = await res.json()
                    if (!res.ok) throw new Error(json.error || 'Send failed')
                  } catch (e) {
                    setTestError(e instanceof Error ? e.message : 'Send failed')
                  } finally {
                    setTesting(false)
                  }
                }}
              >
                {testing ? 'Sending…' : 'Send test SMS'}
              </Button>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <StepEditSheet
        step={editStep}
        onClose={() => setEditStep(null)}
        onTemplateChange={(template) => {
          if (!editStep) return
          setConfig(patchReminderTemplate(config, editStep.stepKey, template))
          setSaved(false)
        }}
        onChannelChange={(channel) => {
          if (!editStep) return
          setConfig(patchReminderChannel(config, editStep.stepKey, channel))
          setSaved(false)
        }}
        onReset={() => {
          if (!editStep) return
          setConfig(resetReminderTemplate(config, editStep.stepKey))
          setSaved(false)
        }}
        onRemove={
          editStep?.isCustom
            ? () => {
                if (!editStep) return
                setConfig(removeReminderStep(config, editStep.stepKey))
                setSaved(false)
                setEditStep(null)
              }
            : undefined
        }
        onAdvancedChange={(patch) => {
          if (!editStep) return
          setConfig(patchReminderAdvanced(config, editStep.stepKey, patch))
          setSaved(false)
        }}
      />
    </div>
  )
}

function TimingEditor({
  minutes,
  onChange,
}: {
  minutes: number
  onChange: (m: number) => void
}) {
  const parts = minutesToParts(minutes)
  return (
    <div className="flex items-center gap-1 text-sm">
      <Input
        type="number"
        min={1}
        className="h-8 w-14 text-center"
        value={parts.value}
        onChange={(e) =>
          onChange(partsToMinutes(Number(e.target.value) || 1, parts.unit))
        }
        aria-label="Timing amount"
      />
      <select
        className="h-8 rounded-md border bg-background px-2 text-xs"
        value={parts.unit}
        onChange={(e) =>
          onChange(partsToMinutes(parts.value, e.target.value as 'minutes' | 'hours' | 'days'))
        }
        aria-label="Timing unit"
      >
        <option value="minutes">minutes before</option>
        <option value="hours">hours before</option>
        <option value="days">days before</option>
      </select>
    </div>
  )
}

function StepEditSheet({
  step,
  onClose,
  onTemplateChange,
  onChannelChange,
  onReset,
  onRemove,
  onAdvancedChange,
}: {
  step: ReminderItem | null
  onClose: () => void
  onTemplateChange: (t: string) => void
  onChannelChange: (c: ReminderChannel) => void
  onReset: () => void
  onRemove?: () => void
  onAdvancedChange: (patch: Record<string, unknown>) => void
}) {
  return (
    <Sheet open={Boolean(step)} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {step ? (
          <>
            <SheetHeader>
              <SheetTitle>Edit {step.title}</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Step name</span>
                <Input value={step.title} onChange={(e) => onAdvancedChange({ label: e.target.value })} />
              </label>
              <SimpleSelect
                label="Channel"
                value={step.channel}
                onChange={(v) => onChannelChange(v as ReminderChannel)}
                options={[
                  { value: 'sms', label: 'SMS' },
                  { value: 'email', label: 'Email' },
                  { value: 'voice', label: 'Voice' },
                ]}
              />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium">Message</span>
                  <Button type="button" variant="ghost" size="sm" onClick={onReset}>Reset default</Button>
                </div>
                <Textarea
                  className="min-h-[140px] font-mono text-sm"
                  value={step.template}
                  onChange={(e) => onTemplateChange(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {step.template.length} characters
                  {step.channel === 'sms' ? ` · ${step.segments} segment(s)` : ''}
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">Insert variable</p>
                <div className="flex flex-wrap gap-1">
                  {REMINDER_MERGE_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() =>
                        onTemplateChange(`${step.template}${step.template.endsWith(' ') ? '' : ' '}${tag}`)
                      }
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
              </div>
              {step.preview ? (
                <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{step.preview}</div>
              ) : null}
              {onRemove ? (
                <Button type="button" variant="destructive" size="sm" onClick={onRemove}>
                  Remove step
                </Button>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
