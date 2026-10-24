'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Panel } from '@/components/app/page-primitives'
import { SimpleSelect } from '@/components/app/filters'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { formatPhone } from '@/lib/format'
import { useMctbSettings } from '@/components/mctb/use-mctb-settings'

export function MctbSetupPanel() {
  const { data, loading, saving, save } = useMctbSettings()
  const [lineId, setLineId] = useState('')
  const [exclusionPhone, setExclusionPhone] = useState('')

  useEffect(() => {
    if (!lineId && data?.numbers[0]) setLineId(data.numbers[0].id)
  }, [data, lineId])

  if (loading || !data) return <p className="text-sm text-muted-foreground">Loading setup…</p>

  const line = data.numbers.find((n) => n.id === lineId)

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Panel title="Recovery">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="mctb-active">Send recovery texts</Label>
          <Switch
            id="mctb-active"
            checked={data.recovery.active}
            disabled={saving}
            onCheckedChange={(on) => void save({ recovery: { enabled: on } }).then(() => toast.success('Saved'))}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          <Link href="/app/mctb/recovery" className="underline">Recovery Controls</Link> — cooldown, triggers, pause.
        </p>
      </Panel>

      <Panel title="Business line">
        <SimpleSelect
          label="Number"
          value={lineId}
          onChange={setLineId}
          options={data.numbers.map((n) => ({ value: n.id, label: `${n.label} (${formatPhone(n.e164)})` }))}
        />
        {line && (
          <Button
            type="button"
            className="mt-3"
            variant="outline"
            disabled={saving}
            onClick={() =>
              void save({
                numberId: lineId,
                line: { enabled: !line.mctb.enabled },
              }).then(() => toast.success('Line updated'))
            }
          >
            {line.mctb.enabled ? 'Disable MCTB on this line' : 'Enable MCTB on this line'}
          </Button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Forwarding verification: <Link href="/app/phone/forwarding" className="underline">Phone → Call Forwarding</Link>.
          Product mode per number: <Link href="/app/numbers" className="underline">Numbers</Link>.
        </p>
      </Panel>

      <Panel title="Consent">
        <SimpleSelect
          label="Consent mode"
          value={data.consent.mode}
          disabled={saving}
          onChange={(mode) => void save({ consent: { mode } }).then(() => toast.success('Consent mode saved'))}
          options={[
            { value: 'press_1', label: 'Ask callers to press 1' },
            { value: 'existing_consent', label: 'Use permission my business already has' },
          ]}
        />
        {data.consent.mode === 'existing_consent' && !data.consent.attestation?.attestedAt && (
          <div className="mt-3 flex items-start gap-2">
            <Checkbox
              id="attest"
              onCheckedChange={(on) => {
                if (on) void save({ consent: { certifyExistingConsent: true } }).then(() => toast.success('Attestation recorded'))
              }}
            />
            <Label htmlFor="attest" className="text-sm font-normal leading-snug">
              I confirm my business already has permission to text missed callers for this use case.
            </Label>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Press-1 audio is managed on the voice runtime for the assigned ingress line. View captures in{' '}
          <Link href="/app/mctb/compliance/consent" className="underline">Consent log</Link>.
        </p>
      </Panel>

      <Panel title="Text-back template">
        <SimpleSelect
          label="First recovery message template"
          value={data.template.selectedId}
          disabled={saving}
          onChange={(templateId) => void save({ templateId }).then(() => toast.success('Template saved'))}
          options={data.template.templates.map((t) => ({ value: t.id, label: t.name }))}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Preview: {data.template.templates.find((t) => t.id === data.template.selectedId)?.preview ?? '—'}
        </p>
      </Panel>

      <Panel title="Exclusions">
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border px-2 py-1 text-sm"
            placeholder="+1…"
            value={exclusionPhone}
            onChange={(e) => setExclusionPhone(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={saving || !exclusionPhone.trim()}
            onClick={() =>
              void save({ addExclusion: exclusionPhone.trim() })
                .then(() => {
                  setExclusionPhone('')
                  toast.success('Excluded')
                })
            }
          >
            Add
          </Button>
        </div>
        <ul className="mt-3 divide-y text-sm">
          {data.exclusions.map((x) => (
            <li key={x.id} className="flex items-center justify-between py-2">
              <span className="font-mono">{formatPhone(x.phone)}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void save({ removeExclusionId: x.id })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Test & activate">
        <p className="text-sm text-muted-foreground">
          Place a test call to your public business line, let it ring unanswered, and confirm a missed-call row appears under{' '}
          <Link href="/app/mctb/calls" className="underline">Missed Calls</Link>.
        </p>
      </Panel>
    </div>
  )
}
