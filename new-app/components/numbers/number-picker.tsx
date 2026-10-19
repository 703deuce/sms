'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowRightLeft, Check, Hash, Loader2, PhoneForwarded, Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { StatusBadge } from '@/components/app/status'
import { useNumbers } from '@/components/providers/numbers-provider'
import { CONNECTION_STATUS, PRODUCT_LABEL, type NumberProduct } from '@/lib/numbers'
import { fetchNumberBindings, switchNumberProduct, type NumberBinding } from '@/lib/numbers-api'
import { formatPhone } from '@/lib/format'
import { Callout } from './number-ui'
import { cn } from '@/lib/utils'

export type ConnectionRef = { kind: 'owned' | 'external'; id: string }

export function useResolvedConnection(ref: ConnectionRef) {
  const { owned, connections } = useNumbers()
  if (ref.kind === 'owned') {
    const n = owned.find((x) => x.id === ref.id)
    if (!n) return null
    return { kind: 'owned' as const, id: n.id, number: n.number, label: n.nickname, verified: n.status === 'active', statusLabel: n.status === 'active' ? 'Connected' : 'Not ready', products: n.assignments.map((a) => a.product), href: `/app/numbers/${n.id}` }
  }
  const c = connections.find((x) => x.id === ref.id)
  if (!c) return null
  return { kind: 'external' as const, id: c.id, number: c.number, label: c.label, verified: c.status === 'verified', statusLabel: CONNECTION_STATUS[c.status].label, products: c.products as NumberProduct[], href: `/app/numbers/connections/${c.id}`, forwardsTo: c.forwardsTo, carrier: c.carrier, lastTest: c.lastTest }
}

/** Shared picker used by every product. Shows which other products a change affects. */
export function NumberPicker({
  open,
  onOpenChange,
  product,
  current,
  onSelect,
  provisionOnSelect = true,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  product: NumberProduct
  current: ConnectionRef
  onSelect: (ref: ConnectionRef) => void
  /** When true, owned Telnyx numbers are re-provisioned for this product before onSelect. */
  provisionOnSelect?: boolean
}) {
  const { owned, connections, refresh } = useNumbers()
  const [picked, setPicked] = useState<ConnectionRef | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingBindings, setPendingBindings] = useState<NumberBinding[]>([])
  const sel = picked ?? current
  const changed = sel.kind !== current.kind || sel.id !== current.id
  const voiceProduct = product === 'phone' || product === 'receptionist' || product === 'mctb'

  const others = (products: NumberProduct[]) => products.filter((p) => p !== product)
  const currentOwned = current.kind === 'owned' ? owned.find((n) => n.id === current.id) : null
  const currentExt = current.kind === 'external' ? connections.find((c) => c.id === current.id) : null
  const leaving = others(currentOwned ? currentOwned.assignments.map((a) => a.product) : (currentExt?.products ?? []))
  const pickedOwned = sel.kind === 'owned' ? owned.find((n) => n.id === sel.id) : null
  const pickedExt = sel.kind === 'external' ? connections.find((c) => c.id === sel.id) : null
  const joining = others(pickedOwned ? pickedOwned.assignments.map((a) => a.product) : (pickedExt?.products ?? []))
  const ret = `?product=${product}`

  async function runProvision(confirmSwitch: boolean) {
    if (sel.kind !== 'owned' || !provisionOnSelect || !voiceProduct) return true
    setSaving(true)
    try {
      const result = await switchNumberProduct({
        phoneNumberId: sel.id,
        targetProduct: product,
        confirmSwitch,
      })
      if (result.needsConfirmation) {
        const bindings = await fetchNumberBindings(sel.id)
        const conflicts = bindings.filter((b) => b.product !== product)
        setPendingBindings(conflicts)
        setConfirmOpen(true)
        return false
      }
      if (!result.ok) {
        toast.error('Could not provision this number for carrier routing')
        return false
      }
      await refresh()
      return true
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Provisioning failed')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function applySelection(confirmSwitch = false) {
    if (sel.kind === 'owned' && provisionOnSelect && voiceProduct) {
      const ok = await runProvision(confirmSwitch)
      if (!ok) return
    }
    onSelect(sel)
    onOpenChange(false)
    setPicked(null)
    setConfirmOpen(false)
    setPendingBindings([])
  }

  return (
    <>
    <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch voice routing?</DialogTitle>
          <DialogDescription>
            This number is already set up for another product. Continuing will re-provision Telnyx and LiveKit routing for{' '}
            {PRODUCT_LABEL[product]}.
          </DialogDescription>
        </DialogHeader>
        {pendingBindings.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            {pendingBindings.map((b) => (
              <li key={`${b.product}-${b.detail}`}>
                {PRODUCT_LABEL[b.product]} — {b.detail}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            onClick={() => {
              void applySelection(true)
            }}
            disabled={saving}
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Yes, switch and provision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPicked(null) }}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b p-5">
          <SheetTitle>Choose a number</SheetTitle>
          <SheetDescription>From your workspace Numbers. {PRODUCT_LABEL[product]} answers calls that reach it.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-5">
          <Group title="Transovo numbers">
            {owned.filter((n) => n.capabilities.voice && n.status !== 'releasing').map((n) => (
              <Option
                key={n.id}
                selected={sel.kind === 'owned' && sel.id === n.id}
                disabled={n.status !== 'active'}
                onSelect={() => setPicked({ kind: 'owned', id: n.id })}
                icon={Hash}
                title={formatPhone(n.number)}
                subtitle={`${n.nickname} · ${n.assignments.length ? n.assignments.map((a) => PRODUCT_LABEL[a.product]).join(', ') : 'Unassigned'}`}
                badge={n.status !== 'active' ? <StatusBadge tone="muted">Not ready</StatusBadge> : undefined}
              />
            ))}
          </Group>
          <Group title="Your carrier, forwarded">
            {connections.map((c) => (
              <Option
                key={c.id}
                selected={sel.kind === 'external' && sel.id === c.id}
                onSelect={() => setPicked({ kind: 'external', id: c.id })}
                icon={PhoneForwarded}
                title={formatPhone(c.number)}
                subtitle={`${c.label} · ${c.carrier}`}
                badge={<StatusBadge tone={CONNECTION_STATUS[c.status].tone}>{CONNECTION_STATUS[c.status].label}</StatusBadge>}
              />
            ))}
          </Group>
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant="outline" size="sm" render={<Link href={`/app/numbers/new${ret}`} />}><Plus data-icon="inline-start" />Get number</Button>
            <Button variant="outline" size="sm" render={<Link href={`/app/numbers/connect${ret}`} />}><PhoneForwarded data-icon="inline-start" />Forward mine</Button>
            <Button variant="outline" size="sm" render={<Link href="/app/numbers/port" />}><ArrowRightLeft data-icon="inline-start" />Port</Button>
          </div>
          {changed && (
            <Callout tone={leaving.length || joining.length ? 'warning' : 'info'} icon={TriangleAlert} title="Service impact">
              <ul className="flex list-disc flex-col gap-1 pl-4">
                <li>{PRODUCT_LABEL[product]} stops answering {currentOwned ? formatPhone(currentOwned.number) : currentExt ? formatPhone(currentExt.number) : 'the old line'} once you publish.</li>
                {leaving.length > 0 && <li>{leaving.map((p) => PRODUCT_LABEL[p]).join(', ')} keep running on the old number.</li>}
                {joining.length > 0 && <li>The new number already routes to {joining.map((p) => PRODUCT_LABEL[p]).join(', ')} — coverage will be shared.</li>}
                {pickedExt && <li>Forwarding at {pickedExt.carrier} stays your action; we only handle calls that arrive.</li>}
              </ul>
            </Callout>
          )}
        </div>
        <SheetFooter className="flex-row justify-end border-t p-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button
            disabled={!changed || saving}
            onClick={() => {
              void applySelection(false)
            }}
          >
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            Use this number
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
    </>
  )
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</span>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  )
}

function Option({ selected, disabled, onSelect, icon: Icon, title, subtitle, badge }: { selected: boolean; disabled?: boolean; onSelect: () => void; icon: React.ComponentType<{ className?: string }>; title: string; subtitle: string; badge?: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
      className={cn('flex items-center gap-3 rounded-lg surface p-3 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50', selected ? 'ring-2 ring-primary' : 'hover:bg-muted/40')}
    >
      <span className={cn('flex size-8 items-center justify-center rounded-md', selected ? 'tile-primary' : 'bg-muted text-muted-foreground')}>
        <Icon className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium tabular-nums">{title}</span>
        <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {badge}
      {selected && <Check className="size-4 text-primary" aria-hidden />}
    </button>
  )
}
