'use client'

import { useEffect, useState } from 'react'
import { PhoneForwarded } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { fetchTransferTargets, type TransferTargetDto } from '@/lib/phone-api'
import { useWorkspace } from '@/components/providers/workspace-provider'

export function ActiveCallTransferButton({ disabled }: { disabled?: boolean }) {
  const { transferActiveCall, activeCall } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [targets, setTargets] = useState<TransferTargetDto[]>([])
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    void fetchTransferTargets()
      .then(setTargets)
      .catch(() => setTargets([]))
  }, [open])

  const runTransfer = async (to: string) => {
    if (!to.trim()) return
    setBusy(true)
    try {
      await transferActiveCall(to.trim())
      setOpen(false)
      setCustom('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        className="text-accent-foreground hover:bg-card hover:text-foreground"
        onClick={() => setOpen(true)}
        disabled={disabled || !activeCall?.humanCallId}
      >
        <PhoneForwarded />
        <span className="hidden sm:inline">Transfer</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer call</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {targets.length > 0 && (
              <ul className="flex flex-col gap-2">
                {targets.map((t) => (
                  <li key={t.id}>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start"
                      disabled={busy}
                      onClick={() => void runTransfer(t.number)}
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">{t.number}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="transfer-custom">Or enter a number</Label>
              <Input
                id="transfer-custom"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder="+1…"
                className="font-mono"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => void runTransfer(custom)} disabled={busy || !custom.trim()}>
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
