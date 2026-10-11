'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, MessagesSquare } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import type { ArCustomerResponseSummary } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import { EmptyState, Initials, Panel, TextLink } from '@/newui-transplant/components/app/kit'
import { Button } from '@/newui-transplant/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'
import { cn } from '@/lib/utils'

type ConversationRow = {
  appointmentId: string
  conversationId: string | null
  customerName: string
  appointmentTitle: string
  startsAt: string
  lastMessagePreview: string
  lastActivityAt: string
  unread: boolean
  needsAttention: boolean
  customerResponse: ArCustomerResponseSummary
}

type ThreadMessage = {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
  label?: string | null
}

export function ArOverviewConversationsPanel() {
  const [rows, setRows] = useState<ConversationRow[]>([])
  const [gated, setGated] = useState(false)
  const [gateMessage, setGateMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [threadLoading, setThreadLoading] = useState(false)
  const [thread, setThread] = useState<{
    customerName: string
    appointmentTitle: string
    startsAt: string
    customerResponse: ArCustomerResponseSummary
    messages: ThreadMessage[]
  } | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/appointment-reminders/conversations?limit=8', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error('load_failed')
      setGated(Boolean(json.data?.gated))
      setGateMessage(json.data?.message || '')
      setRows(json.data?.conversations || [])
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  const openThread = useCallback(async (appointmentId: string) => {
    setSelectedId(appointmentId)
    setThreadLoading(true)
    setThread(null)
    try {
      const res = await fetch(`/api/appointment-reminders/conversations/${appointmentId}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error('thread_failed')
      setThread({
        customerName: json.data.customerName,
        appointmentTitle: json.data.appointmentTitle,
        startsAt: json.data.startsAt,
        customerResponse: json.data.customerResponse,
        messages: json.data.messages || [],
      })
      void loadList()
    } catch {
      setThread(null)
    } finally {
      setThreadLoading(false)
    }
  }, [loadList])

  const unreadCount = rows.filter((r) => r.unread).length

  return (
    <>
      <Panel
        title="Customer replies"
        description="Recent SMS conversations from appointment reminders — open any thread without leaving Overview."
        action={
          <div className="flex items-center gap-3">
            {unreadCount > 0 ? (
              <span className="text-xs font-medium text-primary">{unreadCount} unread</span>
            ) : null}
            <TextLink href={AR_ROUTES.responses}>View all conversations</TextLink>
          </div>
        }
        bodyClassName="p-0"
        className="mb-6"
      >
        {loading ? (
          <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading conversations…
          </p>
        ) : gated ? (
          <div className="p-5">
            <EmptyState
              icon={MessagesSquare}
              title="Upgrade to see customer replies"
              description={
                gateMessage ||
                'Starter and above include full SMS reply history, confirmations, and free-text messages from customers.'
              }
              action={
                <Button nativeButton={false} render={<Link href={`${AR_ROUTES.settings}?tab=billing`} />}>
                  View plans
                </Button>
              }
            />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="No customer replies yet"
            description="When someone texts back after a reminder, the full conversation will show here."
            action={
              <Button variant="outline" nativeButton={false} render={<Link href={AR_ROUTES.reminders} />}>
                View reminder log
              </Button>
            }
          />
        ) : (
          <ul className="divide-y">
            {rows.map((row) => (
              <li key={row.appointmentId}>
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                  onClick={() => void openThread(row.appointmentId)}
                >
                  <Initials name={row.customerName} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {row.unread ? (
                          <span className="mr-1.5 inline-block size-2 rounded-full bg-primary align-middle" aria-hidden="true" />
                        ) : null}
                        {row.customerName}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {new Date(row.lastActivityAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.appointmentTitle} · {new Date(row.startsAt).toLocaleString()}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm text-foreground/90">{row.lastMessagePreview}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <CustomerResponsePill
                        label={row.customerResponse.listDisplayLine || row.customerResponse.label}
                        kind={row.customerResponse.kind}
                      />
                      {row.needsAttention ? (
                        <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Needs attention</span>
                      ) : null}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{thread?.customerName || 'Conversation'}</SheetTitle>
          </SheetHeader>
          {threadLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading thread…
            </p>
          ) : thread ? (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                <p className="font-medium">{thread.appointmentTitle}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(thread.startsAt).toLocaleString()}
                </p>
                <div className="mt-2">
                  <CustomerResponsePill
                    label={thread.customerResponse.listDisplayLine || thread.customerResponse.label}
                    kind={thread.customerResponse.kind}
                  />
                </div>
              </div>
              <ol className="space-y-3" aria-label="Message history">
                {thread.messages.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No messages stored for this appointment yet.</li>
                ) : (
                  thread.messages.map((m) => (
                    <li
                      key={m.id}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-sm',
                        m.direction === 'outbound' ? 'ml-4 bg-primary/5' : 'mr-4 bg-card',
                      )}
                    >
                      <p className="text-[11px] font-medium text-muted-foreground">{m.label}</p>
                      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
                        {new Date(m.createdAt).toLocaleString()}
                      </p>
                    </li>
                  ))
                )}
              </ol>
              <TextLink href={`${AR_ROUTES.responses}?view=needs_attention`}>Open in Responses</TextLink>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}
