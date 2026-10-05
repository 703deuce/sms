'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { ConfigSection, Pill, SettingRow } from '@/newui-transplant/components/app/kit'
import { OPUS_CARD } from '@/newui-transplant/components/app/opus-surfaces'
import { SimpleSelect } from '@/newui-transplant/components/app/simple-select'
import { Input } from '@/newui-transplant/components/ui/input'
import { SaveBar } from '@/newui-transplant/components/app/save-bar'
import { saveMctbSetup } from '@/lib/newui-transplant/api/mctb-setup-client'
import { cn } from '@/lib/utils'
import {
  MCTB_CALLBACK_TIME_AFTER_HOURS_PRESET_OPTIONS,
  MCTB_CALLBACK_TIME_PRESET_OPTIONS,
} from '@/lib/mctb/first-text-templates/callback-time'
import {
  isMctbFirstTextTemplateEntitled,
  MCTB_FIRST_TEXT_FREE_TEMPLATE_IDS,
} from '@/lib/mctb/first-text-templates/entitlements'
import {
  MCTB_FIRST_TEXT_TEMPLATE_ORDER,
  MCTB_FIRST_TEXT_TEMPLATE_REGISTRY,
} from '@/lib/mctb/first-text-templates/registry'
import {
  renderMctbFirstTextTemplateBody,
  validateMctbFirstTextTemplateConfig,
} from '@/lib/mctb/first-text-templates/render'
import type {
  MctbCallbackTimePreset,
  MctbCallbackTimeVariable,
  MctbFirstTextTemplateConfig,
  MctbFirstTextTemplateId,
} from '@/lib/mctb/first-text-templates/types'
import { MCTB_FIRST_TEXT_TEMPLATE_VERSION } from '@/lib/mctb/first-text-templates/types'

function isFreeTemplate(id: MctbFirstTextTemplateId): boolean {
  return (MCTB_FIRST_TEXT_FREE_TEMPLATE_IDS as readonly string[]).includes(id)
}

export function FirstTextTemplateEditor({
  initialConfig,
  businessName,
  recoveryPaid,
  previewInBusinessHours = true,
  onSaved,
}: {
  initialConfig: MctbFirstTextTemplateConfig
  businessName: string
  recoveryPaid: boolean
  previewInBusinessHours?: boolean
  onSaved?: () => void | Promise<void>
}) {
  const [config, setConfig] = useState<MctbFirstTextTemplateConfig>(initialConfig)
  const [upgradeHint, setUpgradeHint] = useState<MctbFirstTextTemplateId | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  const entitled = (id: MctbFirstTextTemplateId) =>
    isMctbFirstTextTemplateEntitled(id, { recoveryPaid })

  const previewBody = useMemo(
    () =>
      renderMctbFirstTextTemplateBody({
        config,
        businessName: businessName || 'Your business',
        inBusinessHours: previewInBusinessHours,
      }),
    [config, businessName, previewInBusinessHours],
  )

  const segments = Math.max(1, Math.ceil(previewBody.length / 160))

  const def = MCTB_FIRST_TEXT_TEMPLATE_REGISTRY[config.templateId]

  const selectTemplate = (id: MctbFirstTextTemplateId) => {
    if (!entitled(id)) {
      setUpgradeHint(id)
      return
    }
    setUpgradeHint(null)
    setConfig((prev) => ({
      ...prev,
      templateId: id,
      version: MCTB_FIRST_TEXT_TEMPLATE_VERSION,
    }))
  }

  const updateCallback = (
    key: 'callbackTime' | 'callbackTimeAfterHours',
    patch: Partial<MctbCallbackTimeVariable>,
  ) => {
    setConfig((prev) => ({
      ...prev,
      variables: {
        ...prev.variables,
        [key]: { ...(prev.variables[key] || { preset: 'within_30_minutes' }), ...patch },
      },
    }))
  }

  const onSave = async () => {
    setSaveError(null)
    const v = validateMctbFirstTextTemplateConfig(config, businessName, true)
    if (!v.ok) {
      setSaveError(v.message)
      throw new Error(v.message)
    }
    const vAh = validateMctbFirstTextTemplateConfig(config, businessName, false)
    if (!vAh.ok) {
      setSaveError(vAh.message)
      throw new Error(vAh.message)
    }
    await saveMctbSetup({ firstTextTemplate: config })
    await onSaved?.()
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Pick a first-message strategy. Transovo sends this after consent — no AI required. Replies notify your team so
        you can call back.
      </p>

      <ul className="divide-y rounded-xl border bg-card/80" role="radiogroup" aria-label="First message strategy">
        {MCTB_FIRST_TEXT_TEMPLATE_ORDER.map((id) => {
          const row = MCTB_FIRST_TEXT_TEMPLATE_REGISTRY[id]
          const selected = config.templateId === id
          const locked = !entitled(id)
          const example = renderMctbFirstTextTemplateBody({
            config: { templateId: id, version: 1, variables: config.variables },
            businessName: businessName || "Joe's Plumbing",
            inBusinessHours: true,
          })
          return (
            <li key={id}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                className={cn(
                  'flex w-full gap-3 px-4 py-3 text-left transition-colors',
                  selected ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
                onClick={() => selectTemplate(id)}
              >
                <span
                  className={cn(
                    'mt-1 size-4 shrink-0 rounded-full border-2',
                    selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{row.name}</span>
                    <Pill tone={isFreeTemplate(id) ? 'neutral' : 'primary'}>
                      {isFreeTemplate(id) ? 'Free' : 'Paid'}
                    </Pill>
                    {locked ? (
                      <Pill tone="warning">
                        <Lock className="mr-1 size-3" aria-hidden /> Upgrade
                      </Pill>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{row.purpose}</span>
                  <span className="mt-2 block text-xs leading-relaxed text-foreground/80">{example}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {upgradeHint ? (
        <div className="rounded-lg border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900/50 dark:bg-amber-950/30">
          <p className="font-medium text-foreground">
            {MCTB_FIRST_TEXT_TEMPLATE_REGISTRY[upgradeHint].name} is included with Text Back plans
          </p>
          <p className="mt-1 text-muted-foreground">
            You can preview paid strategies above. Upgrade to select and save this template.
          </p>
          <Link
            href="/settings/billing?upgrade=mctb_recovery"
            className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
          >
            View upgrade options
          </Link>
        </div>
      ) : null}

      {def.usesCallbackTime ? (
        <ConfigSection
          title="Callback time"
          description="Choose a time you can consistently meet."
          insetClassName="space-y-4"
        >
          <SettingRow
            title="During business hours"
            description="Shown when the missed call happens in your business-hours window."
            control={
              <CallbackTimeControl
                value={config.variables.callbackTime}
                options={MCTB_CALLBACK_TIME_PRESET_OPTIONS}
                onChange={(v) => updateCallback('callbackTime', v)}
              />
            }
          />
          <SettingRow
            title="After hours"
            description="Use an expectation you can meet when the business is closed."
            control={
              <CallbackTimeControl
                value={config.variables.callbackTimeAfterHours}
                options={MCTB_CALLBACK_TIME_AFTER_HOURS_PRESET_OPTIONS}
                onChange={(v) => updateCallback('callbackTimeAfterHours', v)}
              />
            }
          />
        </ConfigSection>
      ) : null}

      {config.templateId === 'quick_question' ? (
        <ConfigSection title="Quick question options" insetClassName="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">First option</span>
            <Input
              className="mt-1"
              value={config.variables.service1 || ''}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  variables: { ...prev.variables, service1: e.target.value },
                }))
              }
              placeholder="e.g. a repair"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Second option</span>
            <Input
              className="mt-1"
              value={config.variables.service2 || ''}
              onChange={(e) =>
                setConfig((prev) => ({
                  ...prev,
                  variables: { ...prev.variables, service2: e.target.value },
                }))
              }
              placeholder="e.g. an estimate"
            />
          </label>
        </ConfigSection>
      ) : null}

      <div className={cn(OPUS_CARD, 'p-4')}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caller will receive</p>
        <p className="mt-2 text-sm leading-relaxed text-foreground">{previewBody}</p>
        <p className="mt-2 text-xs tabular-nums text-muted-foreground">
          {previewBody.length} chars · {segments} segment{segments > 1 ? 's' : ''} (est.)
        </p>
      </div>

      {saveError ? (
        <p className="text-sm text-destructive" role="alert">{saveError}</p>
      ) : null}

      <div className="flex justify-end">
        <SaveBar onSave={onSave} />
      </div>
    </div>
  )
}

function CallbackTimeControl({
  value,
  options,
  onChange,
}: {
  value?: MctbCallbackTimeVariable | null
  options: Array<{ value: MctbCallbackTimePreset; label: string }>
  onChange: (patch: Partial<MctbCallbackTimeVariable>) => void
}) {
  const preset = value?.preset || options[0]?.value || 'within_30_minutes'
  return (
    <div className="flex w-full max-w-xs flex-col gap-2">
      <SimpleSelect
        label="Callback time"
        value={preset}
        options={options.map((o) => ({ value: o.value, label: o.label }))}
        onChange={(v) => onChange({ preset: v as MctbCallbackTimePreset })}
      />
      {preset === 'custom' ? (
        <Input
          aria-label="Custom callback time"
          placeholder="within about 45 minutes"
          value={value?.customText || ''}
          onChange={(e) => onChange({ customText: e.target.value })}
        />
      ) : null}
    </div>
  )
}
