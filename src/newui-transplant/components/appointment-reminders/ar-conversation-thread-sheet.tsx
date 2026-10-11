'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { AR_ROUTES } from '@/lib/appointment-reminders/routes'
import type { ArCustomerResponseSummary } from '@/lib/appointment-reminders/ar-sms-customer-outcome'
import { CustomerResponsePill } from '@/newui-transplant/components/appointment-reminders/customer-response-pill'
import { ArSmsConversationThread, type ArSmsThreadMessage } from '@/newui-transplant/components/appointment-reminders/ar-sms-conversation-thread'
import { TextLink } from '@/newui-transplant/components/app/kit'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/newui-transplant/components/ui/sheet'

type ThreadPayload = {
  customerName: string
  appointmentTitle: string
  startsAt: string
  customerResponse: ArCustomerResponseSummary
  messages: ArSmsThreadMessage[]
}

export function ArConversationThreadSheet({
  appointmentId,
  open,
  onOpenChange,
  responsesDeepLink = true,
}: {
  appointmentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  responsesDeepLink?: boolean
}) {
  const [threadLoading, setThreadLoading] = useState(false)
  const [thread, setThread] = useState<ThreadPayload | null>(null)

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true)
    setThread(null)
    try {
      const res = await fetch(`/api/appointment-reminders/conversations/${id}`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) throw new Error('thread_failed')
      setThread({
        customerName: json.data.customerName,
        appointmentTitle: json.data.appointmentTitle,
        startsAt: json.data.startsAt,
        customerResponse: json.data.customerResponse,
        messages: json.data.messages || [],
      })
    } catch {
      setThread(null)
    } finally {
      setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open && appointmentId) void loadThread(appointmentId)
    if (!open) setThread(null)
  }, [open, appointmentId, loadThread])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-5 py-4 text-left">
          <SheetTitle className="text-base">{thread?.customerName || 'Conversation'}</SheetTitle>
          {thread ? (
            <>
              <p className="text-sm text-muted-foreground">
                {thread.appointmentTitle} · {new Date(thread.startsAt).toLocaleString()}
              </p>
              <div className="pt-2">
                <CustomerResponsePill
                  label={thread.customerResponse.listDisplayLine || thread.customerResponse.label}
                  kind={thread.customerResponse.kind}
                />
              </div>
            </>
          ) : null}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {threadLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Loading messages…
            </p>
          ) : thread ? (
            <ArSmsConversationThread messages={thread.messages} />
          ) : appointmentId && !threadLoading ? (
            <p className="text-sm text-muted-foreground">Could not load this conversation.</p>
          ) : null}
        </div>
        {thread && responsesDeepLink ? (
          <div className="border-t px-5 py-3 text-sm">
            <TextLink
              href={`${AR_ROUTES.responses}?view=needs_attention&appointment=${encodeURIComponent(appointmentId || '')}`}
            >
              Open in Responses
            </TextLink>
            {appointmentId ? (
              <>
                {' · '}
                <Link
                  href={`${AR_ROUTES.appointments}?highlight=${encodeURIComponent(appointmentId)}`}
                  className="font-medium text-primary hover:underline"
                >
                  Appointment details
                </Link>
              </>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
