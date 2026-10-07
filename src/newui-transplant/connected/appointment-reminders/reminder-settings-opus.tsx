'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2 } from 'lucide-react'
import {
  addAdditionalReminderStep,
  buildRemindersPageModel,
  patchReminderAdvanced,
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
import { DEFAULT_PLATFORM_CONFIG, type AppointmentPlatformConfig } from '@/lib/appointments/types'
import type { ReminderItem, ReminderStepKey } from '@/features/appointments/kimi/reminders/types'
import { ReminderSequenceTimeline } from '@/newui-transplant/components/appointment-reminders/reminder-sequence-timeline'
import { Callout, Panel, Stat } from '@/newui-transplant/components/app/kit'
import { OPUS_META_STRIP } from '@/newui-transplant/components/app/opus-surfaces'
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

type WorkspaceStats = {
  activeSteps: number
  scheduledCount: number
  sentToday: number
  failed7d: number
  readiness: { sms: string; email: string }
}

export function AppointmentRemindersSettingsOpus() {
  const [config, setConfig] = useState<RemindersApiConfig | null>(null)
  const [previews, setPreviews] = useState<ReminderPreviewMap>({})
  const [workspace, setWorkspace] = useState<WorkspaceStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(true)
  const [editStep, setEditStep] = useState<ReminderItem | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testStep, setTestStep] = useState<ReminderStepKey>('confirmation')
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')

  const loadWorkspace = useCallback(() => {
    void fetch('/api/appointments/reminders/workspace')
      .then((r) => r.json())
      .then((json) => {
        const d = json.data
        if (!d?.stats) return
        setWorkspace({
          activeSteps: d.stats.activeSteps,
          scheduledCount: d.stats.scheduledCount,
          sentToday: d.stats.sentToday,
          failed7d: d.stats.failed7d,
          readiness: d.readiness || { sms: '—', email: '—' },
        })
      })
      .catch(() => setWorkspace(null))
  }, [])

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
        loadWorkspace()
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }, [loadWorkspace])

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
      loadWorkspace()
    } catch {
      setSaved(false)
    } finally {
      setSaving(false)
    }
  }, [config, loadWorkspace])

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
  const smsSteps = model.reminders.filter((r) => r.enabled && r.channel === 'sms')

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {saved && !saving ? (
          <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">
            Saved
          </span>
        ) : null}
        <Button onClick={() => void save()} disabled={saving} className="h-10 px-5">
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {workspace ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Active steps" value={String(workspace.activeSteps)} />
          <Stat label="Scheduled" value={String(workspace.scheduledCount)} hint="Upcoming sends" />
          <Stat label="Sent today" value={String(workspace.sentToday)} />
          <Stat
            label="SMS sender"
            value={workspace.readiness.sms}
            hint={workspace.failed7d > 0 ? `${workspace.failed7d} failed (7d)` : undefined}
          />
        </div>
      ) : null}

      <Tabs defaultValue="sequence">
        <TabsList className="h-10">
          <TabsTrigger value="sequence">Reminder sequence</TabsTrigger>
          <TabsTrigger value="preview">Customer preview</TabsTrigger>
          <TabsTrigger value="test">Send test</TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="mt-5 space-y-4">
          <Panel
            title="SMS reminder sequence"
            description="Like a drip campaign: confirmations and timed texts before each appointment. Changes apply to future appointments only."
            bodyClassName="p-0"
          >
            <ReminderSequenceTimeline
              steps={model.reminders}
              onToggle={(stepKey) => {
                const step = resolveReminderStep(asPlatformConfig(config), stepKey)
                if (!step) return
                setConfig(patchReminderEnabled(config, stepKey, !step.enabled))
                setSaved(false)
              }}
              onEdit={setEditStep}
              onAdd={() => {
                setConfig(addAdditionalReminderStep(config))
                setSaved(false)
              }}
              onMinutesChange={(stepKey, minutes) => {
                setConfig(patchReminderMinutesBefore(config, stepKey, minutes))
                setSaved(false)
              }}
            />
          </Panel>

          <Callout tone="neutral" icon={AlertTriangle} title="Consent and compliance">
            Recipient consent and SMS sender registration are enforced at send time. Manage compliance in{' '}
            <Link href="/compliance" className="font-medium underline">Compliance</Link>
            {' '}and phone extraction in calendar field mapping.
          </Callout>
        </TabsContent>

        <TabsContent value="preview" className="mt-5">
          <Panel
            title="What customers receive"
            description="Rendered with sample merge data — matches production SMS wording."
          >
            <ul className="space-y-4">
              {smsSteps.length === 0 ? (
                <li className="text-sm text-muted-foreground">Enable at least one SMS step to preview.</li>
              ) : (
                smsSteps.map((r) => (
                  <li key={r.stepKey} className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{r.badge}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.preview || r.template}</p>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="test" className="mt-5">
          <Panel title="Send test SMS" description="One live text using your saved templates and workspace sender.">
            <div className={OPUS_META_STRIP + ' mb-4 text-muted-foreground'}>
              Tests use the same pipeline as appointment reminders — not a mock composer.
            </div>
            <div className="grid gap-4 sm:max-w-md">
              <SimpleSelect
                label="Reminder step"
                value={testStep}
                onChange={(v) => setTestStep(v as ReminderStepKey)}
                options={stepOptions}
              />
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Test phone</span>
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} autoComplete="tel" className="h-10" />
              </label>
              {testError ? <p className="text-xs text-destructive" role="alert">{testError}</p> : null}
              <Button
                className="h-10"
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

function StepEditSheet({
  step,
  onClose,
  onTemplateChange,
  onReset,
  onRemove,
  onAdvancedChange,
}: {
  step: ReminderItem | null
  onClose: () => void
  onTemplateChange: (t: string) => void
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
            <div className="mt-6 space-y-5">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Step name</span>
                <Input
                  className="h-10"
                  value={step.title}
                  onChange={(e) => onAdvancedChange({ label: e.target.value })}
                />
              </label>
              <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
                Channel: <span className="font-medium text-foreground">SMS</span> (Appointment Reminders)
              </p>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-medium">Message</span>
                  <Button type="button" variant="ghost" size="sm" onClick={onReset}>Reset default</Button>
                </div>
                <Textarea
                  className="min-h-[160px] font-mono text-sm leading-relaxed"
                  value={step.template}
                  onChange={(e) => onTemplateChange(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {step.template.length} characters · {step.segments} SMS segment{step.segments === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Insert variable
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDER_MERGE_TAGS.map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-[11px]"
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
                <div className="rounded-xl border bg-muted/25 p-4 text-sm whitespace-pre-wrap leading-relaxed">
                  {step.preview}
                </div>
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
