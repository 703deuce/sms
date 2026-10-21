'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { SettingRow } from '@/components/app/option-group'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/app/status'
import { formatPhone } from '@/lib/format'
import type { MctbConsentMode } from '@/lib/mctb/consent-mode'

type MctbSettings = {
  numbers: Array<{
    id: string
    e164: string
    label: string
    mctb: { enabled: boolean; consentMode: MctbConsentMode }
  }>
  recovery: {
    enabled: boolean
    delaySeconds: number
    cooldownMinutes: number
    triggers: Record<string, boolean>
    manuallyPaused: boolean
    pauseUntil: string | null
  }
  consent: {
    mode: MctbConsentMode
    attestation: { attestedAt: string; attestedByUserId: string } | null
  }
  template: {
    selectedId: string
    templates: Array<{ id: string; name: string; purpose: string; preview: string }>
  }
  recentActivity: Array<{
    id: string
    callerE164: string
    status: string
    suppressionReason: string | null
    smsSentAt: string | null
    detectedAt: string
  }>
  exclusions: Array<{ id: string; phone: string; reason: string | null }>
}

const COOLDOWN_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '1440', label: '24 hours' },
]

const DELAY_OPTIONS = [
  { value: '0', label: 'Immediately' },
  { value: '60', label: '1 minute' },
  { value: '120', label: '2 minutes' },
  { value: '300', label: '5 minutes' },
]

export function PhoneMctbSettings() {
  const [data, setData] = useState<MctbSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedNumberId, setSelectedNumberId] = useState<string>('')
  const [certifyChecked, setCertifyChecked] = useState(false)
  const [exclusionInput, setExclusionInput] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/phone/mctb')
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Load failed')
      setData(json.data)
      if (!selectedNumberId && json.data.numbers[0]?.id) {
        setSelectedNumberId(json.data.numbers[0].id)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not load settings')
    } finally {
      setLoading(false)
    }
  }, [selectedNumberId])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res = await fetch('/api/phone/mctb', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error || 'Save failed')
      setData(json.data)
      toast.success('Saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading || !data) {
    return <p className="text-sm text-muted-foreground">Loading Missed Call Text Back…</p>
  }

  const selectedNumber = data.numbers.find((n) => n.id === selectedNumberId) || data.numbers[0]
  const selectedTemplate =
    data.template.templates.find((t) => t.id === data.template.selectedId) ||
    data.template.templates[0]

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Business number" description="MCTB runs on your Transovo Phone line after the call is missed. It does not change how calls are answered.">
        <div className="flex flex-col gap-3">
          <SimpleSelect
            label="Phone number"
            value={selectedNumber?.id || ''}
            onValueChange={setSelectedNumberId}
            options={data.numbers.map((n) => ({ value: n.id, label: `${n.label} · ${formatPhone(n.e164)}` }))}
          />
          {selectedNumber && (
            <SettingRow
              title="MCTB for this number"
              description="When off, missed calls on this line will not trigger recovery texts."
              control={
                <Switch
                  checked={selectedNumber.mctb.enabled}
                  disabled={saving}
                  onCheckedChange={(v) =>
                    void save({
                      numberId: selectedNumber.id,
                      line: { enabled: v },
                    })
                  }
                  aria-label="Enable MCTB for selected number"
                />
              }
            />
          )}
        </div>
      </Panel>

      <Panel title="Recovery status">
        <SettingRow
          title="Missed Call Text Back"
          description="Master switch for automated recovery SMS (platform sender)."
          control={
            <Switch
              checked={data.recovery.enabled}
              disabled={saving}
              onCheckedChange={(v) => void save({ recovery: { ...data.recovery, enabled: v } })}
            />
          }
        />
        <SettingRow
          title="Pause recovery"
          description="Stops new recovery texts until you resume. Phone calls are unaffected."
          control={
            <Switch
              checked={data.recovery.manuallyPaused}
              disabled={saving}
              onCheckedChange={(v) =>
                void save({ recovery: { ...data.recovery, manuallyPaused: v, pauseUntil: null } })
              }
            />
          }
        />
      </Panel>

      <Panel title="Consent" description="Default is existing permission with your certification on file.">
        <SimpleSelect
          label="Consent method"
          value={data.consent.mode}
          onValueChange={(v) => void save({ consent: { mode: v } })}
          options={[
            { value: 'existing_consent', label: 'Existing consent (default)' },
            { value: 'press_1', label: 'Press 1 on the call' },
          ]}
        />
        {data.consent.mode === 'existing_consent' && (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="certify"
                checked={certifyChecked || Boolean(data.consent.attestation)}
                disabled={Boolean(data.consent.attestation) || saving}
                onCheckedChange={(v) => setCertifyChecked(v === true)}
              />
              <Label htmlFor="certify" className="text-sm font-normal leading-snug">
                I certify that my business has already obtained permission to send these recovery messages to callers,
                and I will honor STOP and opt-out requests.
              </Label>
            </div>
            {data.consent.attestation ? (
              <p className="text-xs text-muted-foreground">
                Certified {new Date(data.consent.attestation.attestedAt).toLocaleString()}
              </p>
            ) : (
              <Button
                size="sm"
                disabled={!certifyChecked || saving}
                onClick={() => void save({ consent: { certifyExistingConsent: true } })}
              >
                Save certification
              </Button>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title="Recovery text template"
        description="Pick one of five platform-approved first messages. Transovo sends this after consent — wording is fixed; you choose the strategy."
      >
        <ul
          className="divide-y rounded-xl border bg-card"
          role="radiogroup"
          aria-label="Recovery message template"
        >
          {data.template.templates.map((t) => {
            const selected = data.template.selectedId === t.id
            return (
              <li key={t.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={saving}
                  className={cn(
                    'flex w-full gap-3 px-4 py-3 text-left transition-colors',
                    selected ? 'bg-primary/5' : 'hover:bg-muted/40',
                    saving && 'opacity-60',
                  )}
                  onClick={() => {
                    if (selected) return
                    void save({ templateId: t.id })
                  }}
                >
                  <span
                    className={cn(
                      'mt-1 size-4 shrink-0 rounded-full border-2',
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{t.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{t.purpose}</span>
                    <span className="mt-2 block text-xs leading-relaxed text-foreground/85">{t.preview}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        {selectedTemplate && (
          <div className="mt-4 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Selected preview</p>
            <div className="max-w-md rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              {selectedTemplate.preview}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Recovery rules">
        <div className="grid gap-4 sm:grid-cols-2">
          <SimpleSelect
            label="Delay before sending"
            value={String(data.recovery.delaySeconds)}
            onValueChange={(v) =>
              void save({ recovery: { ...data.recovery, delaySeconds: Number(v) } })
            }
            options={DELAY_OPTIONS}
          />
          <SimpleSelect
            label="Repeat caller cooldown"
            value={String(data.recovery.cooldownMinutes)}
            onValueChange={(v) =>
              void save({ recovery: { ...data.recovery, cooldownMinutes: Number(v) } })
            }
            options={COOLDOWN_OPTIONS}
          />
        </div>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium">Missed-call triggers</legend>
          {[
            ['noAnswer', 'No answer'],
            ['busy', 'Busy'],
            ['rejected', 'Rejected'],
            ['unreachable', 'Unreachable'],
            ['voicemail', 'Voicemail'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={Boolean(data.recovery.triggers[key])}
                onCheckedChange={(v) =>
                  void save({
                    recovery: {
                      ...data.recovery,
                      triggers: { ...data.recovery.triggers, [key]: v === true },
                    },
                  })
                }
              />
              {label}
            </label>
          ))}
        </fieldset>
      </Panel>

      <Panel title="Exclusions">
        <div className="flex flex-wrap gap-2">
          <input
            className="min-w-[12rem] flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="+1…"
            value={exclusionInput}
            onChange={(e) => setExclusionInput(e.target.value)}
            aria-label="Excluded phone number"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={!exclusionInput.trim() || saving}
            onClick={() => {
              void save({ addExclusion: exclusionInput.trim() }).then(() => setExclusionInput(''))
            }}
          >
            Add
          </Button>
        </div>
        <ul className="mt-3 space-y-1 text-sm">
          {data.exclusions.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <span>{formatPhone(row.phone)}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void save({ removeExclusionId: row.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Recent activity">
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-muted-foreground">No missed-call recovery events yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {data.recentActivity.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{formatPhone(row.callerE164)}</span>
                <StatusBadge tone={row.smsSentAt ? 'success' : row.suppressionReason ? 'muted' : 'warning'}>
                  {row.smsSentAt ? 'Text sent' : row.suppressionReason || row.status}
                </StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
