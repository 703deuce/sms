'use client'

import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SimpleSelect } from '@/components/app/filters'
import { useAgent } from '@/components/providers/agent-provider'
import type { AgentConfig, IntakeField } from '@/lib/agent'

const STAGE_LABEL: Record<IntakeField['stage'], string> = {
  start: 'Start of call',
  before_booking: 'Before booking',
  before_transfer: 'Before transfer',
  end: 'End of call',
}
const TYPE_LABEL: Record<IntakeField['type'], string> = {
  text: 'Text',
  phone: 'Phone',
  email: 'Email',
  choice: 'Choice',
  date: 'Date',
  zip: 'ZIP',
}

export function IntakeFieldsEditor() {
  const { draft, update } = useAgent()
  const set = (fn: (l: IntakeField[]) => IntakeField[]) => update('intake', fn)
  const move = (i: number, d: -1 | 1) =>
    set((l) => {
      const n = [...l]
      const j = i + d
      if (j < 0 || j >= n.length) return l
      ;[n[i], n[j]] = [n[j], n[i]]
      return n
    })

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Intake fields</span>
      <p className="text-xs text-muted-foreground">
        The agent asks naturally — fields guide what to collect, not a rigid script. Information already given in
        conversation should not be repeated.
      </p>
      <div className="flex flex-col divide-y rounded-lg ring-1 ring-foreground/8">
        {draft.intake.map((f, i) => (
          <div key={f.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex flex-col">
              <Button variant="ghost" size="icon-xs" aria-label={`Move ${f.label} up`} disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp />
              </Button>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label={`Move ${f.label} down`}
                disabled={i === draft.intake.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown />
              </Button>
            </div>
            <div className="flex min-w-40 flex-1 flex-col gap-1">
              {f.locked ? (
                <span className="flex items-center gap-1.5 text-sm font-medium">
                  <Lock className="size-3 text-muted-foreground" aria-hidden />
                  {f.label}
                </span>
              ) : (
                <Input
                  aria-label="Field label"
                  className="h-8"
                  value={f.label}
                  onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, label: e.target.value } : x)))}
                />
              )}
              <span className="text-xs text-muted-foreground">
                {TYPE_LABEL[f.type]}
                {f.options ? ` · ${f.options.length} options` : ''}
              </span>
            </div>
            <SimpleSelect
              label={`${f.label} stage`}
              className="w-40"
              value={f.stage}
              onChange={(v) => set((l) => l.map((x) => (x.id === f.id ? { ...x, stage: v } : x)))}
              options={(Object.keys(STAGE_LABEL) as IntakeField['stage'][]).map((s) => ({
                value: s,
                label: STAGE_LABEL[s],
              }))}
            />
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={f.required}
                disabled={f.locked && f.required}
                onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, required: e.target.checked } : x)))}
              />
              Required
            </label>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                className="accent-[var(--primary)]"
                checked={f.qualifies}
                onChange={(e) => set((l) => l.map((x) => (x.id === f.id ? { ...x, qualifies: e.target.checked } : x)))}
              />
              Qualifies
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${f.label}`}
              disabled={f.locked}
              onClick={() => set((l) => l.filter((x) => x.id !== f.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() =>
          set((l) => [
            ...l,
            {
              id: `i_${Date.now()}`,
              label: 'New question',
              type: 'text',
              required: false,
              qualifies: false,
              stage: 'before_booking',
            },
          ])
        }
      >
        <Plus data-icon="inline-start" />
        Add field
      </Button>
    </div>
  )
}

export function QualificationRulesEditor() {
  const { draft, update } = useAgent()
  const q = draft.qualification
  const fields = draft.intake.filter((f) => f.qualifies)
  const setQ = (patch: Partial<AgentConfig['qualification']>) => update('qualification', (x) => ({ ...x, ...patch }))

  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Caller qualifies when</span>
        <SimpleSelect
          label="Match"
          className="w-24"
          value={q.match}
          onChange={(v) => setQ({ match: v })}
          options={[{ value: 'all', label: 'all' }, { value: 'any', label: 'any' }]}
        />
        <span className="text-muted-foreground">rules match</span>
      </div>
      {q.rules.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <SimpleSelect
            label="Field"
            className="w-44"
            value={r.field}
            onChange={(v) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, field: v } : x)) })}
            options={(fields.length ? fields : draft.intake).map((f) => ({ value: f.label, label: f.label }))}
          />
          <SimpleSelect
            label="Operator"
            className="w-32"
            value={r.operator}
            onChange={(v) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, operator: v } : x)) })}
            options={[
              { value: 'in', label: 'is in' },
              { value: 'not_in', label: 'is not in' },
              { value: 'equals', label: 'equals' },
            ]}
          />
          <Input
            aria-label="Values"
            className="min-w-40 flex-1"
            value={r.values}
            onChange={(e) => setQ({ rules: q.rules.map((x) => (x.id === r.id ? { ...x, values: e.target.value } : x)) })}
          />
          <Button variant="ghost" size="icon-sm" aria-label="Remove rule" onClick={() => setQ({ rules: q.rules.filter((x) => x.id !== r.id) })}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setQ({
              rules: [
                ...q.rules,
                {
                  id: `q_${Date.now()}`,
                  field: fields[0]?.label ?? draft.intake[0]?.label ?? 'ZIP code',
                  operator: 'equals',
                  values: '',
                },
              ],
            })
          }
        >
          <Plus data-icon="inline-start" />
          Add rule
        </Button>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">If not qualified</span>
          <SimpleSelect
            label="Fallback"
            className="w-44"
            value={q.fallback}
            onChange={(v) => setQ({ fallback: v })}
            options={[
              { value: 'callback', label: 'Offer a callback' },
              { value: 'transfer', label: 'Transfer to staff' },
              { value: 'decline', label: 'Politely decline' },
            ]}
          />
        </div>
      </div>
      <button
        type="button"
        onClick={() => toast('Sample: agent collects ZIP, then offers a callback per your rules.')}
        className="self-start text-xs font-medium text-primary hover:underline"
      >
        Try a sample caller
      </button>
    </div>
  )
}
