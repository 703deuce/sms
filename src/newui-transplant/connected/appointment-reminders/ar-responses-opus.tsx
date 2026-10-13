'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, MessageSquare } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import type { ArCustomerResponseKind } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { ArOpusPage } from '@/newui-transplant/components/appointment-reminders/ar-opus-layout'
import { ArConversationThreadSheet } from '@/newui-transplant/components/appointment-reminders/ar-conversation-thread-sheet'
import { OpusSchedulingHero } from '@/newui-transplant/components/appointment-reminders/opus-scheduling-chrome'
import { EmptyState, Panel } from '@/newui-transplant/components/app/kit'
import { OPUS_TABLE_HEAD } from '@/newui-transplant/components/app/opus-surfaces'
import { th, td } from '@/newui-transplant/components/app/opus-tables'
import { Button } from '@/newui-transplant/components/ui/button'
import { cn } from '@/lib/utils'

type FeedView = 'all' | 'needs_attention' | 'held'

type ResponseRow = {
  id: string
  source: 'appointment' | 'held'
  appointmentId: string | null
  customerLabel: string
  appointmentLabel: string
  startsAt: string | null
  channel: string
  responseLabel: string
  responseKind: ArCustomerResponseKind | 'held'
  detailLine?: string
  bodyPreview?: string
  occurredAt: string
  actionHref: string | null
  heldId?: string
  heldReplySessionId?: string | null
}

const TABS: Array<{ view: FeedView; label: string }> = [
  { view: 'needs_attention', label: 'Needs attention' },
  { view: 'all', label: 'All responses' },
  { view: 'held', label: 'Held' },
]

function pillKind(kind: ResponseRow['responseKind']): ArCustomerResponseKind {
  if (kind === 'held') return 'awaiting_reply'
  return kind
}

export function ArResponsesOpusPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const rawView = searchParams.get('view')
  const view: FeedView =
    rawView === 'needs_attention' || rawView === 'held' || rawView === 'all' ? rawView : 'needs_attention'

  const [rows, setRows] = useState<ResponseRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyHeldId, setBusyHeldId] = useState<string | null>(null)
  const [conversationAppointmentId, setConversationAppointmentId] = useState<string | null>(null)

  const appointmentFromUrl = searchParams.get('appointment')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/appointment-reminders/responses?view=${view}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'load_failed')
      setRows(json.data?.rows || [])
    } catch {
      setError('Could not load responses.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [view])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (appointmentFromUrl && appointmentFromUrl.length > 0) {
      setConversationAppointmentId(appointmentFromUrl)
    }
  }, [appointmentFromUrl])

  async function resolveHeld(id: string, resolution: 'dismiss' | 'route_ar', replySessionId?: string) {
    setBusyHeldId(id)
    try {
      const res = await fetch(`/api/appointment-reminders/held-inbound/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, replySessionId }),
      })
      if (!res.ok) throw new Error('resolve_failed')
      await load()
    } catch {
      setError('Could not update held message.')
    } finally {
      setBusyHeldId(null)
    }
  }

  const setView = (next: FeedView) => {
    const sp = new URLSearchParams(searchParams.toString())
    sp.set('view', next)
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
  }

  return (
    <ArOpusPage>
      <OpusSchedulingHero
        icon={MessageSquare}
        title="Responses"
        description="Customer confirmations, cancellation and reschedule requests, and messages that need staff review — in one place."
        actions={
          <Button
            variant="outline"
            className="h-9"
            onClick={() => {
              window.location.href = '/api/appointment-reminders/export/responses?days=30'
            }}
          >
            Export CSV
          </Button>
        }
      />

      <nav className="mb-4 flex gap-1 overflow-x-auto border-b" aria-label="Response views">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            onClick={() => setView(tab.view)}
            className={cn(
              'shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              view === tab.view
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === 'held' ? (
        <p className="mb-4 text-sm text-muted-foreground">
          Held messages are inbound texts on shared platform numbers that could not be routed automatically.
          Review and dismiss, or open the related appointment when known.
        </p>
      ) : null}

      <Panel
        title="Response list"
        description="Select a row to read the full SMS conversation when an appointment is linked."
        bodyClassName="p-0"
      >
        {loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading responses…
          </p>
        ) : error ? (
          <p className="p-5 text-sm text-destructive" role="alert">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title={view === 'held' ? 'No held messages' : 'No responses in this view'}
            description={
              view === 'needs_attention'
                ? 'When customers request changes or replies need review, they appear here.'
                : 'Responses from reminder SMS and email actions appear here as they are recorded.'
            }
            action={
              <Button variant="outline" render={<Link href={AR_ROUTES.appointments} />}>
                View appointments
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className={OPUS_TABLE_HEAD}>
                <tr>
                  <th scope="col" className={th}>Customer</th>
                  <th scope="col" className={th}>Appointment</th>
                  <th scope="col" className={th}>Response</th>
                  <th scope="col" className={th}>Channel</th>
                  <th scope="col" className={th}>When</th>
                  <th scope="col" className={th}><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'hover:bg-muted/30',
                      row.appointmentId && 'cursor-pointer',
                      conversationAppointmentId === row.appointmentId && 'bg-primary/5',
                    )}
                    onClick={() => {
                      if (row.appointmentId) setConversationAppointmentId(row.appointmentId)
                    }}
                  >
                    <td className={`${td} font-medium`}>{row.customerLabel}</td>
                    <td className={td}>
                      <span className="block truncate">{row.appointmentLabel}</span>
                      {row.startsAt ? (
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {new Date(row.startsAt).toLocaleString()}
                        </span>
                      ) : null}
                      {row.bodyPreview ? (
                        <span className="mt-1 block rounded-md bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                          {row.bodyPreview}
                        </span>
                      ) : null}
                    </td>
                    <td className={td}>
                      <CustomerResponsePill label={row.responseLabel} kind={pillKind(row.responseKind)} />
                      {row.detailLine ? (
                        <span className="mt-1 block text-xs text-muted-foreground">{row.detailLine}</span>
                      ) : null}
                    </td>
                    <td className={td}>{row.channel.toUpperCase()}</td>
                    <td className={`${td} tabular-nums text-muted-foreground`}>
                      {new Date(row.occurredAt).toLocaleString()}
                    </td>
                    <td className={td}>
                      <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
                        {row.appointmentId ? (
                          <button
                            type="button"
                            className="text-left text-xs font-medium text-primary hover:underline"
                            onClick={() => setConversationAppointmentId(row.appointmentId)}
                          >
                            Read conversation
                          </button>
                        ) : null}
                        {row.actionHref ? (
                          <Link href={row.actionHref} className="text-xs font-medium text-primary hover:underline">
                            Open appointment
                          </Link>
                        ) : null}
                        {row.heldId ? (
                          <div className="flex flex-wrap gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={busyHeldId === row.heldId}
                              onClick={() => void resolveHeld(row.heldId!, 'dismiss')}
                            >
                              Dismiss
                            </Button>
                            {row.heldReplySessionId ? (
                              <Button
                                type="button"
                                size="sm"
                                disabled={busyHeldId === row.heldId}
                                onClick={() =>
                                  void resolveHeld(row.heldId!, 'route_ar', row.heldReplySessionId!)
                                }
                              >
                                Route to AR
                              </Button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <ArConversationThreadSheet
        appointmentId={conversationAppointmentId}
        open={Boolean(conversationAppointmentId)}
        onOpenChange={(open) => {
          if (!open) {
            setConversationAppointmentId(null)
            if (appointmentFromUrl) {
              const sp = new URLSearchParams(searchParams.toString())
              sp.delete('appointment')
              router.replace(`${pathname}?${sp.toString()}`, { scroll: false })
            }
          }
        }}
        responsesDeepLink={false}
      />
    </ArOpusPage>
  )
}
