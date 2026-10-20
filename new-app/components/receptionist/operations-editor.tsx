'use client'

import { CalendarClock, GitBranch, Moon, PhoneForwarded, Plus, Siren, Trash2 } from 'lucide-react'
import type { AgentConfig, DayOfWeek, OnCallScheduleEntry, TransferPlanStep, UrgencyRule } from '@/lib/agent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SimpleSelect } from '@/components/app/filters'
import { OptionGroup } from '@/components/app/option-group'
import { StatusBadge } from '@/components/app/status'
import { Callout } from '@/components/numbers/number-ui'
import { Pills, Section, ToggleRow } from './ai-ui'

const DAYS: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

const DAY_LABEL: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

type Props = {
  draft: AgentConfig
  update: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K] | ((prev: AgentConfig[K]) => AgentConfig[K])) => void
}

function ScheduleDayRows({
  days,
  getRow,
  onClosedChange,
  onTimeChange,
  closedLabel,
}: {
  days: DayOfWeek[]
  getRow: (day: DayOfWeek) => { closed: boolean; ranges: { start: string; end: string }[] }
  onClosedChange: (day: DayOfWeek, closed: boolean) => void
  onTimeChange: (day: DayOfWeek, start: string, end: string) => void
  closedLabel: string
}) {
  return (
    <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
      {days.map((day) => {
        const row = getRow(day)
        const start = row.ranges[0]?.start ?? '09:00'
        const end = row.ranges[0]?.end ?? '17:00'
        return (
          <div key={day} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-medium sm:w-28">{DAY_LABEL[day]}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <ToggleRow
                title={closedLabel}
                checked={row.closed}
                onChange={(v) => onClosedChange(day, v)}
              />
              {!row.closed && (
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${day}-open`} className="text-xs text-muted-foreground">Opens</Label>
                    <Input id={`${day}-open`} type="time" className="w-[7.5rem]" value={start} onChange={(e) => onTimeChange(day, e.target.value, end)} />
                  </div>
                  <span className="hidden text-muted-foreground sm:inline" aria-hidden>–</span>
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`${day}-close`} className="text-xs text-muted-foreground">Closes</Label>
                    <Input id={`${day}-close`} type="time" className="w-[7.5rem]" value={end} onChange={(e) => onTimeChange(day, start, e.target.value)} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
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

  const intakeFieldOptions = draft.intake.map((f) => ({ value: f.label, label: f.label }))
  const transferOptions = draft.transfers.filter((t) => t.enabled).map((t) => ({ value: t.id, label: t.name }))

  return (
    <>
      <Section
        id="hours"
        icon={CalendarClock}
        title="Business hours"
        description="Structured weekly schedule — drives after-hours behavior and prompt context."
        badge={<StatusBadge tone="neutral">{schedule.timezone}</StatusBadge>}
      >
        <Callout tone="info">
          Times use your business timezone below. Workspace-wide holidays can still be managed in Settings; closure overrides apply at runtime when configured.
        </Callout>
        <div className="flex flex-col gap-2 sm:max-w-md">
          <Label htmlFor="biz-tz">Business timezone (IANA)</Label>
          <Input
            id="biz-tz"
            placeholder="America/Chicago"
            value={schedule.timezone}
            onChange={(e) =>
              update('operating', (o) => ({
                ...o,
                businessSchedule: { ...o.businessSchedule, timezone: e.target.value },
                onCallSchedule: { ...o.onCallSchedule, timezone: e.target.value },
              }))
            }
          />
        </div>
        <ScheduleDayRows
          days={DAYS}
          closedLabel="Closed all day"
          getRow={(day) => schedule.weekly[day] ?? { closed: true, ranges: [] }}
          onClosedChange={(day, closed) => patchDay(day, { closed })}
          onTimeChange={(day, start, end) => patchDay(day, { closed: false, ranges: [{ start, end }] })}
        />
      </Section>

      {customMode && (
        <Section
          id="custom-coverage"
          icon={CalendarClock}
          title="Custom coverage windows"
          description="When Answer mode is Custom, Ava only answers during these windows."
        >
          <ScheduleDayRows
            days={DAYS}
            closedLabel="Ava off all day"
            getRow={(day) => draft.coverage.customSchedule.weekly[day] ?? { closed: true, ranges: [] }}
            onClosedChange={(day, closed) => patchCustomDay(day, { closed })}
            onTimeChange={(day, start, end) => patchCustomDay(day, { closed: false, ranges: [{ start, end }] })}
          />
        </Section>
      )}

      <Section
        id="after-hours"
        icon={Moon}
        title="After-hours behavior"
        description="Which tools stay available when the business is closed."
      >
        <ToggleRow
          title="Use operating state during calls"
          description="When off, after-hours rules below are ignored for tool authorization."
          checked={draft.operating.afterHoursBehavior.useOperatingStateDuringCalls}
          onChange={(v) =>
            update('operating', (o) => ({
              ...o,
              afterHoursBehavior: { ...o.afterHoursBehavior, useOperatingStateDuringCalls: v },
            }))
          }
        />
        <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8 px-3">
          <ToggleRow title="Allow live booking when closed" checked={whenClosed.allowLiveBooking} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowLiveBooking: v } } }))} />
          <ToggleRow title="Allow callbacks when closed" checked={whenClosed.allowCallbackRequest} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowCallbackRequest: v } } }))} />
          <ToggleRow title="Allow messages when closed" checked={whenClosed.allowMessageTaking} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowMessageTaking: v } } }))} />
          <ToggleRow title="Allow on-call escalation" checked={whenClosed.allowOnCallEscalation} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowOnCallEscalation: v } } }))} />
          <ToggleRow title="Allow office transfers when closed" checked={whenClosed.allowOfficeTransfer} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowOfficeTransfer: v } } }))} />
          <ToggleRow title="Allow normal transfer destinations when closed" checked={whenClosed.allowNormalTransferDestinations} onChange={(v) => update('operating', (o) => ({ ...o, afterHoursBehavior: { ...o.afterHoursBehavior, whenClosed: { ...whenClosed, allowNormalTransferDestinations: v } } }))} />
        </div>
      </Section>

      <Section
        id="on-call"
        icon={PhoneForwarded}
        title="On-call rotation"
        description="Time-based routing for urgent transfers — links to destinations above."
        badge={
          draft.operating.onCallSchedule.enabled ? (
            <StatusBadge tone="success">{draft.operating.onCallSchedule.entries.length} windows</StatusBadge>
          ) : (
            <StatusBadge tone="muted">Off</StatusBadge>
          )
        }
      >
        <ToggleRow
          title="Enable on-call schedule"
          checked={draft.operating.onCallSchedule.enabled}
          onChange={(v) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, enabled: v } }))}
        />
        {draft.operating.onCallSchedule.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No on-call windows yet. Add one for evenings, weekends, or date-specific coverage.</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
            {draft.operating.onCallSchedule.entries.map((entry) => (
              <div key={entry.id} className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor={`oc-name-${entry.id}`}>Label</Label>
                  <Input id={`oc-name-${entry.id}`} value={entry.name ?? ''} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, name: e.target.value } : x)) } }))} />
                </div>
                <SimpleSelect
                  label="Transfer destination"
                  value={entry.destination.transferDestinationId ?? ''}
                  onChange={(v) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, destination: { ...x.destination, transferDestinationId: v } } : x)) } }))}
                  options={transferOptions.length ? transferOptions : [{ value: '', label: 'Add a transfer destination first' }]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`oc-start-${entry.id}`}>Start</Label>
                    <Input id={`oc-start-${entry.id}`} type="time" value={entry.startTime} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, startTime: e.target.value } : x)) } }))} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor={`oc-end-${entry.id}`}>End</Label>
                    <Input id={`oc-end-${entry.id}`} type="time" value={entry.endTime} onChange={(e) => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.map((x) => (x.id === entry.id ? { ...x, endTime: e.target.value } : x)) } }))} />
                  </div>
                </div>
                <div className="flex sm:col-span-2 sm:justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => update('operating', (o) => ({ ...o, onCallSchedule: { ...o.onCallSchedule, entries: o.onCallSchedule.entries.filter((x) => x.id !== entry.id) } }))}>
                    <Trash2 data-icon="inline-start" />
                    Remove window
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addOnCall}>
          <Plus data-icon="inline-start" />
          Add on-call window
        </Button>
      </Section>

      <Section
        id="urgency-rules"
        icon={Siren}
        title="Urgency rules"
        description="Evaluate intake during the call to escalate transfers or callbacks."
        badge={draft.urgency.enabled ? <StatusBadge tone="warning">Active</StatusBadge> : undefined}
      >
        <ToggleRow title="Enable urgency rules" checked={draft.urgency.enabled} onChange={(v) => update('urgency', (u) => ({ ...u, enabled: v }))} />
        {draft.urgency.rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rules yet. Example: match severe pain keywords to transfer to on-call.</p>
        ) : (
          <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
            {draft.urgency.rules.map((rule) => (
              <div key={rule.id} className="grid gap-4 p-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor={`urg-label-${rule.id}`}>Rule name</Label>
                  <Input id={`urg-label-${rule.id}`} value={rule.label ?? ''} placeholder="e.g. Dental emergency" onChange={(e) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, label: e.target.value } : r)) }))} />
                </div>
                <SimpleSelect
                  label="Intake field"
                  value={rule.field}
                  onChange={(v) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, field: v } : r)) }))}
                  options={intakeFieldOptions.length ? intakeFieldOptions : [{ value: rule.field, label: rule.field }]}
                />
                <div className="flex flex-col gap-2 sm:col-span-2">
                  <Label htmlFor={`urg-val-${rule.id}`}>Match value</Label>
                  <Input id={`urg-val-${rule.id}`} value={rule.value} placeholder="Keywords or exact value" onChange={(e) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, value: e.target.value } : r)) }))} />
                </div>
                <OptionGroup
                  label="Severity"
                  value={rule.severity}
                  onChange={(v) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, severity: v } : r)) }))}
                  columns={2}
                  options={[
                    { value: 'URGENT', label: 'Urgent' },
                    { value: 'CRITICAL', label: 'Critical' },
                  ]}
                />
                <SimpleSelect
                  label="Then"
                  value={rule.action}
                  onChange={(v) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, action: v as UrgencyRule['action'] } : r)) }))}
                  options={[
                    { value: 'TRANSFER', label: 'Transfer' },
                    { value: 'TAKE_MESSAGE', label: 'Take message' },
                    { value: 'CALLBACK', label: 'Offer callback' },
                    { value: 'CONTINUE', label: 'Continue with Ava' },
                  ]}
                />
                {rule.action === 'TRANSFER' && (
                  <SimpleSelect
                    label="Transfer destination"
                    value={rule.destinationId ?? ''}
                    onChange={(v) => update('urgency', (u) => ({ ...u, rules: u.rules.map((r) => (r.id === rule.id ? { ...r, destinationId: v } : r)) }))}
                    options={transferOptions}
                  />
                )}
                <div className="flex sm:col-span-2 sm:justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => update('urgency', (u) => ({ ...u, rules: u.rules.filter((r) => r.id !== rule.id) }))}>
                    <Trash2 data-icon="inline-start" />
                    Remove rule
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={addUrgency}>
          <Plus data-icon="inline-start" />
          Add urgency rule
        </Button>
      </Section>

      <Section
        id="waterfall"
        icon={GitBranch}
        title="Transfer waterfall"
        description="Try destinations in order with per-step ring timeouts."
      >
        <Pills
          label="Routing mode"
          value={draft.transferAdvanced.routing}
          onChange={(v) => update('transferAdvanced', (t) => ({ ...t, routing: v }))}
          options={[
            { value: 'single', label: 'Single destination' },
            { value: 'waterfall', label: 'Waterfall' },
          ]}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ring-sec">Default ring time (seconds)</Label>
            <Input
              id="ring-sec"
              type="number"
              min={5}
              max={120}
              value={draft.transferAdvanced.ringSeconds}
              onChange={(e) => update('transferAdvanced', (t) => ({ ...t, ringSeconds: Number(e.target.value) }))}
            />
            <span className="text-xs text-muted-foreground">Each waterfall step can override this timeout.</span>
          </div>
          <ToggleRow
            title="Detect voicemail on transfer"
            description="Helps Ava avoid leaving messages in staff mailboxes when possible."
            checked={draft.transferAdvanced.detectVoicemailOnTransfer}
            onChange={(v) => update('transferAdvanced', (t) => ({ ...t, detectVoicemailOnTransfer: v }))}
          />
        </div>
        {draft.transferAdvanced.routing === 'waterfall' && (
          <>
            {draft.transferAdvanced.planSteps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Add steps in the order callers should ring — first match wins until timeout, then the next step.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {draft.transferAdvanced.planSteps.map((step, idx) => (
                  <li key={`${step.destinationId}-${idx}`} className="flex flex-wrap items-end gap-3 rounded-lg surface p-4">
                    <StatusBadge tone="neutral" className="shrink-0">Step {idx + 1}</StatusBadge>
                    <SimpleSelect
                      label="Destination"
                      value={step.destinationId}
                      onChange={(v) =>
                        update('transferAdvanced', (t) => ({
                          ...t,
                          planSteps: t.planSteps.map((s, i) => (i === idx ? { ...s, destinationId: v } : s)),
                        }))
                      }
                      options={transferOptions}
                    />
                    <div className="flex flex-col gap-1">
                      <Label htmlFor={`step-to-${idx}`} className="text-xs text-muted-foreground">Timeout (sec)</Label>
                      <Input
                        id={`step-to-${idx}`}
                        type="number"
                        className="w-24"
                        min={5}
                        max={120}
                        value={step.timeoutSeconds}
                        onChange={(e) =>
                          update('transferAdvanced', (t) => ({
                            ...t,
                            planSteps: t.planSteps.map((s, i) => (i === idx ? { ...s, timeoutSeconds: Number(e.target.value) } : s)),
                          }))
                        }
                      />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove step ${idx + 1}`}
                      onClick={() => update('transferAdvanced', (t) => ({ ...t, planSteps: t.planSteps.filter((_, i) => i !== idx) }))}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            <Button type="button" variant="outline" size="sm" className="self-start" onClick={addWaterfallStep}>
              <Plus data-icon="inline-start" />
              Add waterfall step
            </Button>
          </>
        )}
      </Section>
    </>
  )
}
