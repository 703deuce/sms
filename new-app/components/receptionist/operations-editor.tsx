'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { AgentConfig, DayOfWeek, OnCallScheduleEntry, TransferPlanStep, UrgencyRule } from '@/lib/agent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/app/filters'
import { Section, ToggleRow } from './ai-ui'

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

type Props = {
  draft: AgentConfig
  update: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K] | ((prev: AgentConfig[K]) => AgentConfig[K])) => void
}

export function OperationsEditor({ draft, update }: Props) {
  const schedule = draft.operating.businessSchedule
  const whenClosed = draft.operating.afterHoursBehavior.whenClosed
  const customMode = draft.coverage.mode === 'custom'

  const patchDay = (day: DayOfWeek, patch: Partial<(typeof schedule.weekly)[DayOfWeek]>) => {
    update('operating', (o) => ({
      ...o,
      businessSchedule: {
        ...o.businessSchedule,
        weekly: {
          ...o.businessSchedule.weekly,
          [day]: { closed: false, ranges: [{ start: '09:00', end: '17:00' }], ...o.businessSchedule.weekly[day], ...patch },
        },
      },
    }))
  }

  const patchCustomDay = (day: DayOfWeek, patch: Partial<(typeof draft.coverage.customSchedule.weekly)[DayOfWeek]>) => {
    update('coverage', (c) => ({
      ...c,
      customSchedule: {
        ...c.customSchedule,
        weekly: {
          ...c.customSchedule.weekly,
          [day]: { closed: false, ranges: [{ start: '09:00', end: '17:00' }], ...c.customSchedule.weekly[day], ...patch },
        },
      },
    }))
  }

  const addOnCall = () => {
    const entry: OnCallScheduleEntry = {
      id: `oc_${Date.now()}`,
      name: 'On-call block',
      dayOfWeek: 1,
      startTime: '17:00',
      endTime: '08:00',
      priority: 10,
      enabled: true,
      destination: { label: 'On-call', transferDestinationId: draft.transfers.find((t) => t.enabled)?.id },
    }
    update('operating', (o) => ({
      ...o,
      onCallSchedule: { ...o.onCallSchedule, enabled: true, entries: [...o.onCallSchedule.entries, entry] },
    }))
  }

  const addUrgency = () => {
    const rule: UrgencyRule = {
      id: `urg_${Date.now()}`,
      field: draft.intake[0]?.label || 'Reason',
      operator: 'contains',
      value: 'severe pain',
      severity: 'URGENT',
      action: 'TRANSFER',
      destinationId: draft.transfers.find((t) => t.enabled)?.id,
    }
    update('urgency', (u) => ({ ...u, enabled: true, rules: [...u.rules, rule] }))
  }

  const addWaterfallStep = () => {
    const enabled = draft.transfers.filter((t) => t.enabled)
    const step: TransferPlanStep = {
      order: draft.transferAdvanced.planSteps.length + 1,
      destinationId: enabled[0]?.id || '',
      transferMode: draft.transferStyle === 'warm' ? 'WARM' : 'BASIC',
      timeoutSeconds: draft.transferAdvanced.ringSeconds,
    }
    update('transferAdvanced', (t) => ({ ...t, routing: 'waterfall', planSteps: [...t.planSteps, step] }))
  }

  return (
    <>
      <Section id="hours" title="Business hours & holidays" description="Structured schedule for after-hours tool gating and prompts.">
        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="biz-tz">Timezone</Label>
          <Input
            id="biz-tz"
            value={schedule.timezone}
            onChange={(e) =>
              update('operating', (o) => ({
                ...o,
                businessSchedule: { ...o.businessSchedule, timezone: e.target.value },
              }))
            }
          />
        </div>
        <div className="flex flex-col gap-2">
          {DAYS.map((day) => {
            const row = schedule.weekly[day] ?? { closed: true, ranges: [] }
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg border border-foreground/10 p-3">
                <span className="w-24 text-sm font-medium capitalize">{day}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={row.closed} onChange={(e) => patchDay(day, { closed: e.target.checked })} />
                  Closed
                </label>
                {!row.closed && (
                  <>
                    <Input
                      aria-label={`${day} open`}
                      className="w-24"
                      value={row.ranges[0]?.start ?? '09:00'}
                      onChange={(e) => patchDay(day, { ranges: [{ start: e.target.value, end: row.ranges[0]?.end ?? '17:00' }] })}
                    />
                    <span className="text-muted-foreground">–</span>
                    <Input
                      aria-label={`${day} close`}
                      className="w-24"
                      value={row.ranges[0]?.end ?? '17:00'}
                      onChange={(e) => patchDay(day, { ranges: [{ start: row.ranges[0]?.start ?? '09:00', end: e.target.value }] })}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      </Section>

      {customMode && (
        <Section id="custom-coverage" title="Custom coverage windows" description="When Answer mode is Custom, Ava uses this schedule instead of business hours above.">
          {DAYS.map((day) => {
            const row = draft.coverage.customSchedule.weekly[day] ?? { closed: true, ranges: [] }
            return (
              <div key={day} className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/30 p-3">
                <span className="w-24 text-sm font-medium capitalize">{day}</span>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={row.closed} onChange={(e) => patchCustomDay(day, { closed: e.target.checked })} />
                  Ava off
                </label>
                {!row.closed && (
                  <>
                    <Input className="w-24" value={row.ranges[0]?.start ?? '09:00'} onChange={(e) => patchCustomDay(day, { ranges: [{ start: e.target.value, end: row.ranges[0]?.end ?? '17:00' }] })} />
                    <span>–</span>
                    <Input className="w-24" value={row.ranges[0]?.end ?? '17:00'} onChange={(e) => patchCustomDay(day, { ranges: [{ start: row.ranges[0]?.start ?? '09:00', end: e.target.value }] })} />
                  </>
                )}
              </div>
            )
          })}
        </Section>
      )}

      <Section id="after-hours" title="After-hours behavior" description="What tools remain available when the business is closed.">
        <ToggleRow
          title="Use operating state during calls"
          checked={draft.operating.afterHoursBehavior.useOperatingStateDuringCalls}
          onChange={(v) =>
            update('operating', (o) => ({
              ...o,
              afterHoursBehavior: { ...o.afterHoursBehavior, useOperatingStateDuringCalls: v },
            }))
          }
        />
        <div className="divide-y">
          <ToggleRow title="Allow live booking when closed" checked={whenClosed.allowLiveBooking} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowLiveBooking: v } } }))} />
          <ToggleRow title="Allow callbacks when closed" checked={whenClosed.allowCallbackRequest} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowCallbackRequest: v } } }))} />
          <ToggleRow title="Allow messages when closed" checked={whenClosed.allowMessageTaking} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowMessageTaking: v } } }))} />
          <ToggleRow title="Allow on-call escalation" checked={whenClosed.allowOnCallEscalation} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowOnCallEscalation: v } } }))} />
          <ToggleRow title="Allow office transfers when closed" checked={whenClosed.allowOfficeTransfer} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowOfficeTransfer: v } } }))} />
        </div>
      </Section>

      <Section id="on-call" title="On-call rotation" description="Time-based destinations for urgent transfers.">
        <ToggleRow
          title="Enable on-call schedule"
          checked={draft.operating.onCallSchedule.enabled}
          onChange={(v) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, enabled: v } }))}
        />
        {draft.operating.onCallSchedule.entries.map((entry) => (
          <div key={entry.id} className="grid gap-2 rounded-lg border border-foreground/10 p-3 sm:grid-cols-2">
            <Input aria-label="On-call label" value={entry.name ?? ''} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, name: e.target.value } : x)) } }))} />
            <SimpleSelect
              label="Destination"
              value={entry.destination.transferDestinationId ?? ''}
              onChange={(v) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, destination: { ...x.destination, transferDestinationId: v } } : x)) } }))}
              options={draft.transfers.map((t) => ({ value: t.id, label: t.name }))}
            />
            <Input aria-label="Start time" value={entry.startTime} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, startTime: e.target.value } : x)) } }))} />
            <Input aria-label="End time" value={entry.endTime} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, endTime: e.target.value } : x)) } }))} />
            <Button type="button" variant="ghost" size="sm" onClick={() => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.filter((x) => x.id !== entry.id) } }))}>
              <Trash2 data-icon="inline-start" /> Remove
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addOnCall}><Plus data-icon="inline-start" />Add on-call window</Button>
      </Section>

      <Section id="urgency-rules" title="Urgency rules" description="Match intake fields to escalate transfers or messages.">
        <ToggleRow title="Enable urgency rules" checked={draft.urgency.enabled} onChange={(v) => update('urgency', (u) => ({ ...u, enabled: v }))} />
        {draft.urgency.rules.map((rule) => (
          <div key={rule.id} className="grid gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2">
            <Input value={rule.label ?? ''} placeholder="Label" onChange={(e) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, label: e.target.value } : r)) }))} />
            <Input value={rule.field} aria-label="Intake field" onChange={(e) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, field: e.target.value } : r)) }))} />
            <Input value={rule.value} aria-label="Match value" onChange={(e) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)) }))} />
            <SimpleSelect label="Action" value={rule.action} onChange={(v) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, action: v as UrgencyRule['action'] } : r)) }))} options={[{ value: 'TRANSFER', label: 'Transfer' }, { value: 'TAKE_MESSAGE', label: 'Message' }, { value: 'CALLBACK', label: 'Callback' }, { value: 'CONTINUE', label: 'Continue' }]} />
            <Button type="button" variant="ghost" size="sm" onClick={() => update('urgency', (u) => ({ ...u, rules: u.rules.filter((r) => r.id !== rule.id) }))}><Trash2 data-icon="inline-start" />Remove</Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addUrgency}><Plus data-icon="inline-start" />Add rule</Button>
      </Section>

      <Section id="waterfall" title="Transfer waterfall" description="Ordered transfer attempts with per-step timeouts.">
        <SimpleSelect
          label="Routing"
          value={draft.transferAdvanced.routing}
          onChange={(v) => update('transferAdvanced', (t) => ({ ...t, routing: v as 'single' | 'waterfall' }))}
          options={[{ value: 'single', label: 'Single destination' }, { value: 'waterfall', label: 'Waterfall (ordered steps)' }]}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>Ring seconds (default)</Label>
            <Input type="number" min={5} max={120} value={draft.transferAdvanced.ringSeconds} onChange={(e) => update('transferAdvanced', (t) => ({ ...t, ringSeconds: Number(e.target.value) }))} />
          </div>
          <ToggleRow title="Detect voicemail on transfer" checked={draft.transferAdvanced.detectVoicemailOnTransfer} onChange={(v) => update('transferAdvanced', (t) => ({ ...t, detectVoicemailOnTransfer: v }))} />
        </div>
        {draft.transferAdvanced.routing === 'waterfall' &&
          draft.transferAdvanced.planSteps.map((step, idx) => (
            <div key={`${step.destinationId}-${idx}`} className="flex flex-wrap items-end gap-2 rounded-lg border border-foreground/10 p-3">
              <span className="text-xs font-medium text-muted-foreground">Step {idx + 1}</span>
              <SimpleSelect
                label="Destination"
                value={step.destinationId}
                onChange={(v) =>
                  update('transferAdvanced', (t) => ({
                    ...t,
                    planSteps: t.planSteps.map((s, i) => (i === idx ? { ...s, destinationId: v } : s)),
                  }))
                }
                options={draft.transfers.filter((d) => d.enabled).map((d) => ({ value: d.id, label: d.name }))}
              />
              <Input
                type="number"
                className="w-24"
                aria-label="Timeout seconds"
                value={step.timeoutSeconds}
                onChange={(e) =>
                  update('transferAdvanced', (t) => ({
                    ...t,
                    planSteps: t.planSteps.map((s, i) => (i === idx ? { ...s, timeoutSeconds: Number(e.target.value) } : s)),
                  }))
                }
              />
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove step" onClick={() => update('transferAdvanced', (t) => ({ ...t, planSteps: t.planSteps.filter((_, i) => i !== idx) }))}>
                <Trash2 />
              </Button>
            </div>
          ))}
        {draft.transferAdvanced.routing === 'waterfall' && (
          <Button type="button" variant="outline" size="sm" onClick={addWaterfallStep}><Plus data-icon="inline-start" />Add waterfall step</Button>
        )}
      </Section>
    </>
  )
}
