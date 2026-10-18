'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StatusBadge, type Tone } from '@/components/app/status'
import { INTEGRATIONS } from '@/lib/data'
import { formatWhen } from '@/lib/format'

type Integration = (typeof INTEGRATIONS)[number]
type Status = 'connected' | 'available' | 'error'

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  connected: { label: 'Connected', tone: 'success' },
  available: { label: 'Not connected', tone: 'muted' },
  error: { label: 'Needs reconnect', tone: 'danger' },
}

const CATEGORIES = ['Calendar', 'CRM', 'Notifications', 'Webhooks'] as const

export function IntegrationsCatalog() {
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.status as Status])),
  )
  const [pendingDisconnect, setPendingDisconnect] = useState<Integration | null>(null)

  const setStatus = (id: string, s: Status) => setStatuses((prev) => ({ ...prev, [id]: s }))

  return (
    <div className="flex flex-col gap-8">
      {CATEGORIES.map((cat) => {
        const items = INTEGRATIONS.filter((i) => i.category === cat)
        if (!items.length) return null
        return (
          <section key={cat} aria-labelledby={`cat-${cat}`} className="flex flex-col gap-3">
            <h2 id={`cat-${cat}`} className="text-sm font-semibold text-muted-foreground">
              {cat}
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((i) => {
                const s = statuses[i.id]
                return (
                  <article key={i.id} className="flex flex-col gap-4 rounded-xl surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-xl bg-linear-to-b from-card to-muted text-sm font-semibold tracking-tight text-foreground/80 shadow-xs ring-1 ring-foreground/8 ring-inset" aria-hidden>
                          {i.name.slice(0, 2)}
                        </span>
                        <h3 className="font-medium">{i.name}</h3>
                      </div>
                      <StatusBadge tone={STATUS[s].tone}>{STATUS[s].label}</StatusBadge>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">{i.detail}</p>
                    <dl className="flex flex-col gap-1 text-xs">
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Powers:</dt>
                        <dd>{i.impacts.join(', ')}</dd>
                      </div>
                      {i.lastSync && s !== 'available' && (
                        <div className="flex gap-1">
                          <dt className="text-muted-foreground">Last sync:</dt>
                          <dd>{formatWhen(i.lastSync)}</dd>
                        </div>
                      )}
                    </dl>
                    <div className="mt-auto flex gap-2">
                      {s === 'available' && (
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setStatus(i.id, 'connected')
                            toast.success(`${i.name} connected`)
                          }}
                        >
                          Connect
                        </Button>
                      )}
                      {s === 'error' && (
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setStatus(i.id, 'connected')
                            toast.success(`${i.name} reconnected`)
                          }}
                        >
                          Reconnect
                        </Button>
                      )}
                      {s !== 'available' && (
                        <Button variant="outline" className={s === 'connected' ? 'flex-1' : ''} onClick={() => setPendingDisconnect(i)}>
                          Disconnect
                        </Button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}

      <Dialog open={!!pendingDisconnect} onOpenChange={(o) => !o && setPendingDisconnect(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect {pendingDisconnect?.name}?</DialogTitle>
            <DialogDescription>Stored credentials are revoked immediately. You can reconnect later.</DialogDescription>
          </DialogHeader>
          {pendingDisconnect && (
            <div className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <p className="leading-relaxed">
                This will stop: <strong>{pendingDisconnect.impacts.join(', ')}</strong>.
                {pendingDisconnect.category === 'Calendar' && ' The AI Receptionist will no longer book appointments and will take messages instead.'}
              </p>
            </div>
          )}
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingDisconnect) return
                setStatus(pendingDisconnect.id, 'available')
                toast.success(`${pendingDisconnect.name} disconnected`)
                setPendingDisconnect(null)
              }}
            >
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
