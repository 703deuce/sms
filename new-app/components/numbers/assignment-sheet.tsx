'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, Plus, Trash2, AlertTriangle, Workflow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useNumbers } from '@/components/providers/numbers-provider'
import { compatibility, inboundFlow, PRODUCT_LABEL, type Assignment, type NumberProduct, type OwnedNumber } from '@/lib/numbers'
import { switchNumberProduct } from '@/lib/numbers-api'
import { formatPhone } from '@/lib/format'
import { SimpleSelect } from '@/components/app/filters'
import { Callout, FlowDiagram } from './number-ui'

const TARGETS: Record<NumberProduct, string[]> = {
  phone: ['Front desk ring group', 'Priya Natarajan', 'Daniel Brooks', 'Main IVR'],
  receptionist: ['Ava (AI agent)'],
  mctb: ['Missed-call recovery'],
  sms: ['Shared SMS inbox'],
}

const SCHEDULES = ['Always', 'Business hours', 'After hours', 'After hours + no answer', 'When unanswered']

const VOICE_PRODUCTS: NumberProduct[] = ['phone', 'receptionist', 'mctb']

export function AssignmentSheet({ number, open, onOpenChange }: { number: OwnedNumber | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { setAssignments, refresh } = useNumbers()
  const [rows, setRows] = useState<Assignment[] | null>(null)
  const [saving, setSaving] = useState(false)
  if (!number) return null
  const list = rows ?? number.assignments

  const errors = list.map((a) => compatibility({ ...number, assignments: [] }, a.product)).map((c) => (c.ok ? null : c.reason))
  const blocked = errors.some(Boolean)
  const reorder = (i: number, d: -1 | 1) => {
    const next = [...list]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setRows(next.map((r, idx) => ({ ...r, priority: idx + 1 })))
  }

  async function save() {
    if (!number) return
    const voiceRows = list.filter((a) => VOICE_PRODUCTS.includes(a.product))
    const primary = voiceRows.sort((a, b) => a.priority - b.priority)[0]
    if (!primary) {
      toast.error('Choose at least one voice product (Phone, AI Receptionist, or MCTB).')
      return
    }
    setSaving(true)
    try {
      let result = await switchNumberProduct({
        phoneNumberId: number.id,
        targetProduct: primary.product,
        confirmSwitch: false,
      })
      if (result.needsConfirmation) {
        result = await switchNumberProduct({
          phoneNumberId: number.id,
          targetProduct: primary.product,
          confirmSwitch: true,
        })
      }
      if (!result.ok) {
        throw new Error(result.error || 'Carrier routing could not be updated')
      }
      if (list.some((a) => a.product === 'mctb')) {
        await fetch('/api/phone/mctb', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            numberId: number.id,
            line: { enabled: true },
          }),
        })
      }
      await refresh()
      setAssignments(number.id, list)
      setRows(null)
      onOpenChange(false)
      toast.success('Number routing updated', {
        description: `${formatPhone(number.number)} → ${PRODUCT_LABEL[primary.product]}.`,
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setRows(null) }}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Manage assignments</SheetTitle>
          <SheetDescription>{number.nickname} · {formatPhone(number.number)}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Order sets who handles an inbound call first. Each product still owns its own settings — this only links the number.
          </p>

          <ol className="flex flex-col gap-2">
            {list.map((a, i) => (
              <li key={a.id} className="flex flex-col gap-3 rounded-xl p-3 surface-raised">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 items-center justify-center rounded-md bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                  <SimpleSelect
                    label="Product"
                    value={a.product}
                    onChange={(p) => setRows(list.map((r) => (r.id === a.id ? { ...r, product: p, target: TARGETS[p][0] } : r)))}
                    options={(Object.keys(PRODUCT_LABEL) as NumberProduct[]).map((p) => ({ value: p, label: PRODUCT_LABEL[p] }))}
                    className="w-40"
                  />
                  <div className="ml-auto flex items-center">
                    <Button variant="ghost" size="icon-sm" disabled={i === 0} onClick={() => reorder(i, -1)} aria-label="Move up"><ArrowUp /></Button>
                    <Button variant="ghost" size="icon-sm" disabled={i === list.length - 1} onClick={() => reorder(i, 1)} aria-label="Move down"><ArrowDown /></Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => setRows(list.filter((r) => r.id !== a.id).map((r, idx) => ({ ...r, priority: idx + 1 })))} aria-label="Remove assignment"><Trash2 /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <SimpleSelect label="Target" value={a.target} onChange={(t) => setRows(list.map((r) => (r.id === a.id ? { ...r, target: t } : r)))} options={TARGETS[a.product].map((t) => ({ value: t, label: t }))} />
                  <SimpleSelect label="When" value={a.schedule} onChange={(s) => setRows(list.map((r) => (r.id === a.id ? { ...r, schedule: s } : r)))} options={SCHEDULES.map((s) => ({ value: s, label: s }))} />
                </div>
                {errors[i] && (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {errors[i]}
                  </p>
                )}
              </li>
            ))}
          </ol>

          <Button
            variant="outline"
            className="self-start"
            onClick={() =>
              setRows([...list, { id: `as_${Date.now()}`, product: 'phone', target: TARGETS.phone[0], schedule: 'Always', priority: list.length + 1, status: 'active' }])
            }
          >
            <Plus data-icon="inline-start" />
            Add assignment
          </Button>

          <div className="flex flex-col gap-3 rounded-xl bg-muted/40 p-4">
            <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <Workflow className="size-3.5" aria-hidden />
              Resulting inbound flow
            </p>
            <FlowDiagram steps={inboundFlow(list)} />
          </div>

          {!list.length && (
            <Callout tone="warning" icon={AlertTriangle}>With no assignments, callers hear an unavailable message.</Callout>
          )}
        </div>

        <SheetFooter className="flex-row justify-end border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={blocked || saving}>{saving ? 'Saving…' : 'Save assignments'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
