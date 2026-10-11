'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { PageHeader, Panel } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import Link from 'next/link'

type HeldRow = {
  id: string
  fromE164: string
  toE164: string
  bodyPreview: string
  holdReason: string
  channel: string
  createdAt: string
  candidates: Array<{
    product: string
    workspaceId: string
    replySessionId?: string
    appointmentId?: string
  }>
}

export function ArHeldInboundOpusPage() {
  const [rows, setRows] = useState<HeldRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    setError('')
    fetch('/api/appointment-reminders/held-inbound')
      .then((r) => {
        if (!r.ok) throw new Error('load_failed')
        return r.json()
      })
      .then((json) => setRows(json.data || []))
      .catch(() => setError('Could not load held messages.'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function resolveRow(
    id: string,
    resolution: 'dismiss' | 'route_ar',
    replySessionId?: string,
  ) {
    setBusyId(id)
    setError('')
    try {
      const res = await fetch(`/api/appointment-reminders/held-inbound/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, replySessionId }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'resolve_failed')
      }
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not resolve held message.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <ArOpusPage>
      <div className="flex flex-col gap-6">
      <PageHeader
        title="Held SMS replies"
        description="Inbound texts on shared platform numbers that could not be routed automatically. Review and dismiss, or route to Appointment Reminders only when the reply session and appointment are known. Messages are never auto-routed to Missed Call Text Back."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.appointments} />}>
            Open appointments
          </Button>
        }
      />

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      {loading ? (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : rows.length === 0 ? (
        <Panel className="text-sm text-muted-foreground">No held messages need review.</Panel>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => {
            const arCandidates = row.candidates.filter((c) => c.product === 'appointment_reminders')
            const singleAr = arCandidates.length === 1 ? arCandidates[0] : null
            return (
              <li key={row.id}>
                <Panel className="space-y-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{row.fromE164}</span>
                    <span className="text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-muted-foreground">{row.holdReason.replace(/_/g, ' ')}</p>
                  <p className="rounded-md bg-muted/40 px-3 py-2">{row.bodyPreview || '(empty)'}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busyId === row.id}
                      onClick={() => void resolveRow(row.id, 'dismiss')}
                    >
                      Dismiss
                    </Button>
                    {singleAr?.replySessionId ? (
                      <Button
                        type="button"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() =>
                          void resolveRow(row.id, 'route_ar', singleAr.replySessionId)
                        }
                      >
                        Route to Appointment Reminders
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground self-center">
                        Manual AR routing requires exactly one AR session in this workspace.
                      </span>
                    )}
                  </div>
                </Panel>
              </li>
            )
          })}
        </ul>
      )}
      </div>
    </ArOpusPage>
  )
}
