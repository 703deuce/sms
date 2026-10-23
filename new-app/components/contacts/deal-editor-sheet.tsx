'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

export type DealEditRow = {
  id: string
  title: string
  stageId: string
  amountCents: number | null
  ownerUserId: string | null
  closeTargetAt: string | null
  nextStep: string | null
  contactId?: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  deal: DealEditRow | null
  stages: { id: string; name: string }[]
  onSaved: () => void
}

export function DealEditorSheet({ open, onOpenChange, deal, stages, onSaved }: Props) {
  const [title, setTitle] = useState('')
  const [stageId, setStageId] = useState('')
  const [amount, setAmount] = useState('')
  const [owner, setOwner] = useState('')
  const [closeTarget, setCloseTarget] = useState('')
  const [nextStep, setNextStep] = useState('')
  const [contactId, setContactId] = useState('')

  useEffect(() => {
    if (!deal || !open) return
    setTitle(deal.title)
    setStageId(deal.stageId)
    setAmount(deal.amountCents != null ? String(deal.amountCents / 100) : '')
    setOwner(deal.ownerUserId || '')
    setCloseTarget(deal.closeTargetAt ? deal.closeTargetAt.slice(0, 10) : '')
    setNextStep(deal.nextStep || '')
    setContactId(deal.contactId || '')
  }, [deal, open])

  const save = async () => {
    if (!deal) return
    try {
      const r = await fetch(`/api/crm/native/deals/${deal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          stageId,
          amountCents: amount.trim() ? Math.round(Number(amount) * 100) : null,
          ownerUserId: owner.trim() || null,
          closeTargetAt: closeTarget ? new Date(closeTarget).toISOString() : null,
          nextStep: nextStep.trim() || null,
          contactId: contactId.trim() || null,
        }),
      })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || 'Save failed')
      toast.success('Deal updated')
      onSaved()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  if (!deal) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit deal</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3 text-sm">
          <label>
            Title
            <Input className="mt-1" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Deal title" />
          </label>
          <label>
            Stage
            <select className="mt-1 w-full rounded border px-2 py-2" value={stageId} onChange={(e) => setStageId(e.target.value)} aria-label="Stage">
              {stages.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>
          <label>
            Value (USD)
            <Input className="mt-1" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Amount" />
          </label>
          <label>
            Owner user ID
            <Input className="mt-1" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Owner" />
          </label>
          <label>
            Expected close
            <Input type="date" className="mt-1" value={closeTarget} onChange={(e) => setCloseTarget(e.target.value)} aria-label="Close date" />
          </label>
          <label>
            Next step
            <Input className="mt-1" value={nextStep} onChange={(e) => setNextStep(e.target.value)} aria-label="Next step" />
          </label>
          <label>
            Contact ID
            <Input className="mt-1" value={contactId} onChange={(e) => setContactId(e.target.value)} aria-label="Contact id" />
          </label>
          <Button type="button" onClick={() => void save()}>Save changes</Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
