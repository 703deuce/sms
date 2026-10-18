'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useNumbers } from '@/components/providers/numbers-provider'
import { PRODUCT_LABEL, type ExternalConnection, type OwnedNumber } from '@/lib/numbers'
import { formatPhone } from '@/lib/format'
import { Callout } from './number-ui'

export function RenameDialog({ number, open, onOpenChange }: { number: OwnedNumber | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { renameNumber } = useNumbers()
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  if (!number) return null
  const current = value || number.nickname

  async function save() {
    if (!number) return
    if (!current.trim()) return
    setSaving(true)
    await new Promise((r) => setTimeout(r, 400))
    renameNumber(number.id, current.trim())
    setSaving(false)
    setValue('')
    onOpenChange(false)
    toast.success('Nickname updated', { description: `${formatPhone(number.number)} is now “${current.trim()}”.` })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setValue('') }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename number</DialogTitle>
          <DialogDescription>{formatPhone(number.number)} · Routing and caller ID are unaffected.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="nickname">Nickname</Label>
          <Input id="nickname" value={current} maxLength={40} onChange={(e) => setValue(e.target.value)} autoFocus />
          <p className="text-xs text-muted-foreground">{current.length}/40</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving || !current.trim()}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReleaseDialog({ number, open, onOpenChange }: { number: OwnedNumber | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { requestRelease } = useNumbers()
  const [typed, setTyped] = useState('')
  const [ack, setAck] = useState(false)
  if (!number) return null
  const tail = number.number.slice(-4)
  const ready = typed === tail && ack

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setTyped(''); setAck(false) } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Release {formatPhone(number.number)}?</DialogTitle>
          <DialogDescription>Releasing returns the number to the carrier. It may be impossible to get it back.</DialogDescription>
        </DialogHeader>
        {number.assignments.length > 0 && (
          <Callout tone="danger" icon={AlertTriangle} title="These will stop working">
            <ul className="mt-1 list-inside list-disc">
              {number.assignments.map((a) => (
                <li key={a.id}>{PRODUCT_LABEL[a.product]} — {a.target}</li>
              ))}
            </ul>
          </Callout>
        )}
        {number.defaultCallerId && (
          <Callout tone="warning" icon={AlertTriangle}>This is the workspace default caller ID. Outbound calls will fall back to the next available number.</Callout>
        )}
        <div className="flex flex-col gap-2">
          <Label htmlFor="release-confirm">Type the last four digits ({tail}) to confirm</Label>
          <Input id="release-confirm" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={ack} onCheckedChange={(v) => setAck(Boolean(v))} className="mt-0.5" />
          <span>I understand callers, saved contacts and printed materials using this number will no longer reach us.</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Keep number</Button>
          <Button
            variant="destructive"
            disabled={!ready}
            onClick={() => {
              requestRelease(number.id)
              onOpenChange(false)
              toast('Release requested', { description: 'Status will update when the carrier confirms.' })
            }}
          >
            Release number
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DisconnectDialog({ connection, open, onOpenChange, onDone }: { connection: ExternalConnection | null; open: boolean; onOpenChange: (o: boolean) => void; onDone?: () => void }) {
  const { disconnect } = useNumbers()
  if (!connection) return null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Disconnect {connection.label}?</DialogTitle>
          <DialogDescription>
            {formatPhone(connection.number)} stays with {connection.carrier}. We stop treating forwarded calls from it as {connection.products.map((p) => PRODUCT_LABEL[p]).join(' / ')} traffic.
          </DialogDescription>
        </DialogHeader>
        <Callout tone="warning" icon={AlertTriangle} title="Turn off forwarding at your carrier too">
          Calls will keep forwarding to {formatPhone(connection.forwardsTo)} until you remove the forwarding rule with {connection.carrier}. Those calls would then reach nobody.
        </Callout>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            onClick={() => {
              disconnect(connection.id)
              onOpenChange(false)
              toast('Connection removed', { description: 'Remember to disable forwarding with your carrier.' })
              onDone?.()
            }}
          >
            Disconnect
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
