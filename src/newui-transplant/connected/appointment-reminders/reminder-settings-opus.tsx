'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, MessageSquare } from 'lucide-react'
import {
  addAdditionalReminderStep,
  buildRemindersPageModel,
  patchReminderAdvanced,
  patchReminderChannel,
  patchReminderEmailBranding,
  patchReminderEmailSubject,
  patchReminderEnabled,
  patchReminderMinutesBefore,
  patchReminderPreferences,
  patchReminderTemplate,
  patchReminderLibraryTemplate,
  removeReminderStep,
  resetReminderTemplate,
  type RemindersApiConfig,
  type ReminderPreviewMap,
  REMINDER_MERGE_TAGS,
} from '@/features/appointments/kimi/reminders/map-reminders'
import { listReminderStepIds, resolveReminderStep } from '@/lib/appointments/reminders/reminders-config'
import { DEFAULT_PLATFORM_CONFIG, type AppointmentPlatformConfig } from '@/lib/appointments/types'
import type { ReminderItem, ReminderStepKey } from '@/features/appointments/kimi/reminders/types'
import { ArStatGrid } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { ReminderSequenceTimeline } from '@/newui-transplant/components/appointment-reminders/reminder-sequence-timeline'
import { Callout, FeatureEmphasisStrip, Panel, Pill, Stat } from '@/newui-transplant/components/app/kit'
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
import { ReminderTemplateEditor } from '@/newui-transplant/components/appointment-reminders/reminder-template-editor'
import { ArSchedulingPreferencesPanel } from '@/newui-transplant/components/appointment-reminders/ar-scheduling-preferences-panel'
import {
  INDUSTRY_LABELS,
  MESSAGE_TYPE_LABELS,
  STEP_TO_MESSAGE_TYPE,
  type TemplateMessageType,
} from '@/lib/appointment-reminders/template-library/types'

function asPlatformConfig(config: RemindersApiConfig): AppointmentPlatformConfig {
  return { ...DEFAULT_PLATFORM_CONFIG, timezone: config.timezone, reminders: config.reminders }
}

async function loadPreviews(config: RemindersApiConfig): Promise<ReminderPreviewMap> {
  const keys = listReminderStepIds(asPlatformConfig(config))
  const entries = await Promise.all(
    keys.map(async (key) => {
      const res = await fetch(`/api/appointment-reminders/reminders/test?step=${encodeURIComponent(key)}`)
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
  smsUsage?: {
    usedInPeriod: number
    limit: number
    atLimit: boolean
    periodKey: string
    meteringActive: boolean
  }
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
  const [testEmail, setTestEmail] = useState('')
  const [testStep, setTestStep] = useState<ReminderStepKey>('confirmation')
  const [presetIndustry, setPresetIndustry] = useState('general')
  const [presetTone, setPresetTone] = useState('friendly')
  const [presetTiming, setPresetTiming] = useState('standard_48h_3h')
  const [presetPolicy, setPresetPolicy] = useState('flexible_24h')
  const [presetLocale, setPresetLocale] = useState('en')
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testError, setTestError] = useState('')
  const [templateLocked, setTemplateLocked] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('Your business')
  const [libraryIndustries, setLibraryIndustries] = useState<
    Array<{ id: string; label: string; messageTypes: Array<{ id: string; label: string }> }>
  >([])

  const loadWorkspace = useCallback(() => {
    void fetch('/api/appointment-reminders/reminders/workspace')
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
          smsUsage: d.smsUsage,
        })
      })
      .catch(() => setWorkspace(null))
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    fetch('/api/appointment-reminders/settings')
      .then((r) => {
        if (!r.ok) throw new Error('settings failed')
        return r.json()
      })
      .then(async (json) => {
        setTemplateLocked(Boolean(json.messaging?.templateEditingLocked))
        if (json.workspace?.name) setWorkspaceName(json.workspace.name)
        const data = json.data
        if (data.reminderPreferences?.templateIndustry) {
          setPresetIndustry(data.reminderPreferences.templateIndustry)
        }
        const nextConfig: RemindersApiConfig = {
          timezone: data.timezone,
          reminders: {
            confirmation: data.reminders.confirmation,
            reminder24h: data.reminders.reminder24h,
            reminder2h: data.reminders.reminder2h,
            additionalSteps: data.reminders.additionalSteps || [],
          },
          reminderEmailBranding: data.reminderEmailBranding,
          reminderPreferences: data.reminderPreferences,
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

  useEffect(() => {
    void fetch('/api/appointment-reminders/templates/library')
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.industries) setLibraryIndustries(json.data.industries)
      })
      .catch(() => setLibraryIndustries([]))
  }, [])

  const model = useMemo(
    () => (config ? buildRemindersPageModel(config, previews) : null),
    [config, previews],
  )

  const save = useCallback(async () => {
    if (!config) return
    setSaving(true)
    setSaved(false)
    try {
      const res = await fetch('/api/appointment-reminders/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminders: config.reminders,
          timezone: config.timezone,
          reminderEmailBranding: config.reminderEmailBranding,
          reminderPreferences: config.reminderPreferences,
        }),
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
  const previewSteps = model.reminders.filter((r) => r.enabled)

  return (
    <div className="space-y-6">
      <FeatureEmphasisStrip
        icon={MessageSquare}
        title="Reminder sequence"
        badge={<Pill tone="success" dot={false}>Workspace engine</Pill>}
        description="SMS and email steps with shared timing rules. Changes apply to future sends only."
        action={
          saved && !saving ? (
            <span className="text-xs font-medium text-[oklch(0.82_0.12_158)]" role="status">Saved</span>
          ) : null
        }
      />

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
        <ArStatGrid>
          <Stat label="Active steps" value={String(workspace.activeSteps)} />
          <Stat label="Scheduled" value={String(workspace.scheduledCount)} hint="Upcoming sends" />
          <Stat label="Sent today" value={String(workspace.sentToday)} />
          <Stat
            label="SMS sender"
            value={workspace.readiness.sms}
            hint={workspace.failed7d > 0 ? `${workspace.failed7d} failed (7d)` : undefined}
          />
          {workspace.smsUsage?.meteringActive ? (
            <Stat
              label="SMS this month"
              value={`${workspace.smsUsage.usedInPeriod} / ${workspace.smsUsage.limit}`}
              hint={workspace.smsUsage.atLimit ? 'Allowance reached — upgrade or wait for reset' : undefined}
            />
          ) : null}
        </ArStatGrid>
      ) : null}

      <Tabs defaultValue="sequence">
        <TabsList className="h-10">
          <TabsTrigger value="sequence">Reminder sequence</TabsTrigger>
          <TabsTrigger value="preview">Customer preview</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling & rules</TabsTrigger>
          <TabsTrigger value="presets">Presets & email</TabsTrigger>
          <TabsTrigger value="test">Send test</TabsTrigger>
        </TabsList>

        <TabsContent value="sequence" className="mt-5 space-y-4">
          <Panel
            title="Reminder sequence"
            description="Confirmations and timed reminders per channel. Changes apply to future appointments only."
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
            description="Rendered with sample merge data — matches production wording."
          >
            <ul className="space-y-4">
              {previewSteps.length === 0 ? (
                <li className="text-sm text-muted-foreground">Enable at least one step to preview.</li>
              ) : (
                previewSteps.map((r) => (
                  <li key={r.stepKey} className="rounded-xl border bg-muted/20 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
                      {r.badge} · {r.channel}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.preview || r.template}</p>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="scheduling" className="mt-5 space-y-4">
          <ArSchedulingPreferencesPanel
            config={config}
            onChange={(next) => {
              setConfig(next)
              setSaved(false)
            }}
          />
        </TabsContent>

        <TabsContent value="presets" className="mt-5 space-y-4">
          <Panel title="Starter packs" description="Industry wording, tone, and timing — all editable after apply.">
            <div className="grid gap-4 sm:grid-cols-2">
              <SimpleSelect
                label="Industry"
                value={presetIndustry}
                onChange={setPresetIndustry}
                options={
                  libraryIndustries.length > 0
                    ? libraryIndustries.map((i) => ({ value: i.id, label: i.label }))
                    : Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({ value, label }))
                }
              />
              <SimpleSelect
                label="Tone"
                value={presetTone}
                onChange={setPresetTone}
                options={[
                  { value: 'formal', label: 'Formal' },
                  { value: 'casual', label: 'Casual' },
                  { value: 'warm', label: 'Warm' },
                  { value: 'friendly', label: 'Friendly' },
                ]}
              />
              <SimpleSelect
                label="Timing preset"
                value={presetTiming}
                onChange={setPresetTiming}
                options={[
                  { value: 'simple_24h', label: 'Simple — 24h' },
                  { value: 'standard_48h_3h', label: 'Standard — 48h & 3h' },
                  { value: 'confirmation_focused', label: 'Confirmation-focused' },
                  { value: 'long_lead', label: 'Long lead' },
                  { value: 'custom', label: 'Custom (templates only)' },
                ]}
              />
              <SimpleSelect
                label="Cancellation policy"
                value={presetPolicy}
                onChange={setPresetPolicy}
                options={[
                  { value: 'flexible_24h', label: '24-hour notice' },
                  { value: 'same_day', label: 'Same-day courtesy' },
                  { value: 'healthcare', label: 'Healthcare courtesy' },
                  { value: 'no_fee', label: 'No fee stated' },
                ]}
              />
              <SimpleSelect
                label="Template language"
                value={presetLocale}
                onChange={setPresetLocale}
                options={[
                  { value: 'en', label: 'English' },
                  { value: 'es', label: 'Spanish (store templates)' },
                  { value: 'fr', label: 'French (store templates)' },
                ]}
              />
            </div>
            <Button
              className="mt-4 h-10"
              disabled={applyingPreset}
              onClick={async () => {
                setApplyingPreset(true)
                try {
                  const res = await fetch('/api/appointment-reminders/settings/presets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      industry: presetIndustry,
                      tone: presetTone,
                      timing: presetTiming,
                      cancellationPolicyId: presetPolicy,
                      locale: presetLocale,
                      apply: true,
                    }),
                  })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json.error || 'Apply failed')
                  const data = json.data
                  setConfig({
                    timezone: data.timezone,
                    reminders: data.reminders,
                    reminderEmailBranding: data.reminderEmailBranding,
                    reminderPreferences: data.reminderPreferences,
                  })
                  setSaved(false)
                  setPreviews(await loadPreviews({
                    timezone: data.timezone,
                    reminders: data.reminders,
                    reminderEmailBranding: data.reminderEmailBranding,
                    reminderPreferences: data.reminderPreferences,
                  }))
                } finally {
                  setApplyingPreset(false)
                }
              }}
            >
              {applyingPreset ? 'Applying…' : 'Apply preset pack'}
            </Button>
          </Panel>
          <Panel title="Email branding" description="Used for HTML reminder emails (logo, color, footer).">
            <div className="grid gap-4 sm:max-w-lg">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Brand color</span>
                <Input
                  className="h-10"
                  value={config.reminderEmailBranding?.brandColor || ''}
                  onChange={(e) => {
                    setConfig(patchReminderEmailBranding(config, { brandColor: e.target.value }))
                    setSaved(false)
                  }}
                  placeholder="#0d9488"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Logo URL</span>
                <Input
                  className="h-10"
                  value={config.reminderEmailBranding?.logoUrl || ''}
                  onChange={(e) => {
                    setConfig(patchReminderEmailBranding(config, { logoUrl: e.target.value }))
                    setSaved(false)
                  }}
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Preparation instructions</span>
                <Textarea
                  value={config.reminderPreferences?.preparationInstructions || ''}
                  onChange={(e) => {
                    setConfig(patchReminderPreferences(config, { preparationInstructions: e.target.value }))
                    setSaved(false)
                  }}
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={config.reminderPreferences?.skipConfirmationStepsWhenConfirmed !== false}
                  onChange={(e) => {
                    setConfig(
                      patchReminderPreferences(config, {
                        skipConfirmationStepsWhenConfirmed: e.target.checked,
                      }),
                    )
                    setSaved(false)
                  }}
                />
                Skip confirmation steps after customer confirms
              </label>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="test" className="mt-5">
          <Panel title="Send test" description="Live SMS or email using saved templates.">
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
                <span className="mb-1.5 block font-medium">Test phone (SMS)</span>
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} autoComplete="tel" className="h-10" />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Test email</span>
                <Input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} autoComplete="email" className="h-10" />
              </label>
              {testError ? <p className="text-xs text-destructive" role="alert">{testError}</p> : null}
              <Button
                className="h-10"
                disabled={testing || (!testPhone.trim() && !testEmail.trim())}
                onClick={async () => {
                  setTesting(true)
                  setTestError('')
                  try {
                    const res = await fetch('/api/appointment-reminders/reminders/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        stepKey: testStep,
                        phone: testPhone.trim() || undefined,
                        email: testEmail.trim() || undefined,
                      }),
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
                {testing ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>

      <StepEditSheet
        step={editStep}
        config={config}
        workspaceName={workspaceName}
        templateIndustry={config.reminderPreferences?.templateIndustry || presetIndustry}
        libraryIndustries={libraryIndustries}
        onClose={() => setEditStep(null)}
        onTemplateChange={(template) => {
          if (!editStep) return
          setConfig(patchReminderTemplate(config, editStep.stepKey, template))
          setSaved(false)
        }}
        onIndustryPackChange={(industry) => {
          setPresetIndustry(industry)
          setConfig(patchReminderPreferences(config, { templateIndustry: industry }))
          setSaved(false)
        }}
        onApplyLibraryTemplate={(entry) => {
          if (!editStep) return
          setConfig(
            patchReminderLibraryTemplate(config, editStep.stepKey, {
              industry: entry.industry,
              messageType: entry.messageType,
              template: entry.body,
              emailSubject: entry.subject || undefined,
            }),
          )
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
        onChannelChange={(channel) => {
          if (!editStep) return
          setConfig(patchReminderChannel(config, editStep.stepKey, channel))
          setSaved(false)
        }}
        onEmailSubjectChange={(subject) => {
          if (!editStep) return
          setConfig(patchReminderEmailSubject(config, editStep.stepKey, subject))
          setSaved(false)
        }}
        onAdvancedChange={(patch) => {
          if (!editStep) return
          setConfig(patchReminderAdvanced(config, editStep.stepKey, patch))
          setSaved(false)
        }}
        templateLocked={templateLocked}
      />
    </div>
  )
}

function StepEditSheet({
  step,
  config,
  workspaceName,
  templateIndustry,
  libraryIndustries,
  onClose,
  onTemplateChange,
  onIndustryPackChange,
  onApplyLibraryTemplate,
  onReset,
  onRemove,
  onChannelChange,
  onEmailSubjectChange,
  onAdvancedChange,
  templateLocked,
}: {
  step: ReminderItem | null
  config: RemindersApiConfig
  workspaceName: string
  templateIndustry: string
  libraryIndustries: Array<{ id: string; label: string; messageTypes: Array<{ id: string; label: string }> }>
  onClose: () => void
  onTemplateChange: (t: string) => void
  onIndustryPackChange: (industry: string) => void
  onApplyLibraryTemplate: (entry: {
    industry: string
    messageType: string
    body: string
    subject: string | null
  }) => void
  onReset: () => void
  onRemove?: () => void
  onChannelChange: (channel: import('@/lib/appointments/types').ReminderChannel) => void
  onEmailSubjectChange: (subject: string) => void
  onAdvancedChange: (patch: Record<string, unknown>) => void
  templateLocked?: boolean
}) {
  const defaultMessageType =
    step && STEP_TO_MESSAGE_TYPE[step.stepKey]
      ? STEP_TO_MESSAGE_TYPE[step.stepKey]
      : ('advance_reminder' as TemplateMessageType)

  const industryOptions =
    libraryIndustries.length > 0
      ? libraryIndustries.map((i) => ({ value: i.id, label: i.label }))
      : Object.entries(INDUSTRY_LABELS).map(([value, label]) => ({ value, label }))

  const messageTypeOptions = (
    libraryIndustries.find((i) => i.id === templateIndustry)?.messageTypes || []
  ).filter((mt) => mt.id !== 'follow_up')

  const isConfirmation = step?.stepKey === 'confirmation'
  const smsLocked = Boolean(templateLocked && step?.channel === 'sms')
  const mergeTags =
    templateLocked && step?.channel === 'sms'
      ? REMINDER_MERGE_TAGS.filter(
          (t) =>
            !t.includes('manage_link') &&
            !t.includes('reschedule_link') &&
            !t.includes('cancel_link') &&
            !t.includes('confirm_link') &&
            !t.includes('appointment_link') &&
            !t.includes('directions_link'),
        )
      : REMINDER_MERGE_TAGS

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
              <SimpleSelect
                label="Channel"
                value={step.channel}
                onChange={(v) => onChannelChange(v as import('@/lib/appointments/types').ReminderChannel)}
                options={[
                  { value: 'sms', label: 'SMS' },
                  { value: 'email', label: 'Email' },
                  { value: 'voice', label: 'Voice' },
                ]}
              />
              {!isConfirmation ? (
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="font-medium">Send-time controls</p>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.skipWeekends === true}
                      onChange={(e) => onAdvancedChange({ skipWeekends: e.target.checked })}
                    />
                    Skip weekends
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.skipOffHours === true}
                      onChange={(e) => onAdvancedChange({ skipOffHours: e.target.checked })}
                    />
                    Skip outside business hours
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.skipClosedDays === true}
                      onChange={(e) => onAdvancedChange({ skipClosedDays: e.target.checked })}
                    />
                    Skip closed days
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={step.skipIfAppointmentConfirmed === true}
                      onChange={(e) =>
                        onAdvancedChange({ skipIfAppointmentConfirmed: e.target.checked })
                      }
                    />
                    Skip if appointment already confirmed
                  </label>
                </div>
              ) : null}
              {templateLocked && step.channel === 'sms' ? (
                <p className="text-xs text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200/60 bg-amber-50/50 px-3 py-2 dark:bg-amber-950/20">
                  Platform sender — SMS uses approved library wording. You can switch industry pack and timing; link tags are stripped at send.
                </p>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <SimpleSelect
                  label="Industry pack"
                  value={templateIndustry}
                  onChange={async (industry) => {
                    onIndustryPackChange(industry)
                    const mt = defaultMessageType
                    const ch = step.channel === 'email' ? 'email' : 'sms'
                    const res = await fetch(
                      `/api/appointment-reminders/templates/library?industry=${encodeURIComponent(industry)}&messageType=${encodeURIComponent(mt)}&channel=${ch}`,
                    )
                    const json = await res.json()
                    if (res.ok && json.data) {
                      onApplyLibraryTemplate({
                        industry,
                        messageType: mt,
                        body: json.data.body,
                        subject: json.data.subject,
                      })
                    }
                  }}
                  options={industryOptions}
                />
                <SimpleSelect
                  label="Message type"
                  value={defaultMessageType}
                  onChange={async (messageType) => {
                    const ch = step.channel === 'email' ? 'email' : 'sms'
                    const res = await fetch(
                      `/api/appointment-reminders/templates/library?industry=${encodeURIComponent(templateIndustry)}&messageType=${encodeURIComponent(messageType)}&channel=${ch}`,
                    )
                    const json = await res.json()
                    if (res.ok && json.data) {
                      onApplyLibraryTemplate({
                        industry: templateIndustry,
                        messageType,
                        body: json.data.body,
                        subject: json.data.subject,
                      })
                    }
                  }}
                  options={
                    messageTypeOptions.length > 0
                      ? messageTypeOptions.map((m) => ({ value: m.id, label: m.label }))
                      : Object.entries(MESSAGE_TYPE_LABELS)
                          .filter(([id]) => id !== 'follow_up')
                          .map(([value, label]) => ({ value, label }))
                  }
                />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="ghost" size="sm" onClick={onReset}>
                  Reset to engine default
                </Button>
              </div>
              <ReminderTemplateEditor
                channel={step.channel === 'email' ? 'email' : 'sms'}
                template={step.template}
                emailSubject={step.emailSubject || `${step.title} — {{business_name}}`}
                readOnly={smsLocked}
                mergeTags={mergeTags}
                businessName={workspaceName}
                timezone={config.timezone}
                businessPhone={config.reminderEmailBranding?.contactPhone}
                location={undefined}
                onTemplateChange={onTemplateChange}
                onEmailSubjectChange={
                  step.channel === 'email' ? onEmailSubjectChange : undefined
                }
                onInsertTag={(tag) => {
                  if (smsLocked) return
                  onTemplateChange(`${step.template}${step.template.endsWith(' ') ? '' : ' '}${tag}`)
                }}
              />
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
