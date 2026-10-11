'use client'

import { cn } from '@/lib/utils'

export type ArSmsThreadMessage = {
  id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  createdAt: string
  label?: string | null
}

function formatMessageTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function ArSmsConversationThread({
  messages,
  className,
  emptyLabel = 'No messages stored for this appointment yet.',
}: {
  messages: ArSmsThreadMessage[]
  className?: string
  emptyLabel?: string
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      role="log"
      aria-label="SMS conversation"
    >
      {messages.map((m) => {
        if (m.direction === 'system') {
          return (
            <div key={m.id} className="flex justify-center px-2">
              <p className="max-w-[95%] rounded-md bg-muted/50 px-2.5 py-1 text-center text-[11px] text-muted-foreground">
                {m.label ? <span className="font-medium">{m.label}: </span> : null}
                <span className="whitespace-pre-wrap">{m.body}</span>
                <span className="mt-0.5 block tabular-nums opacity-80">
                  {formatMessageTime(m.createdAt)}
                </span>
              </p>
            </div>
          )
        }

        const outbound = m.direction === 'outbound'
        const aiLike = outbound && Boolean(m.label?.toLowerCase().includes('ai'))

        return (
          <div
            key={m.id}
            className={cn('flex max-w-[92%] flex-col gap-0.5', outbound ? 'ml-auto items-end' : 'mr-auto items-start')}
          >
            <div
              className={cn(
                'whitespace-pre-wrap px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                outbound
                  ? cn(
                      'rounded-2xl rounded-br-md bg-primary text-primary-foreground',
                      aiLike && 'bg-violet-700 text-white dark:bg-violet-600',
                    )
                  : 'rounded-2xl rounded-bl-md border border-border/80 bg-muted/80 text-foreground',
              )}
            >
              {m.body}
            </div>
            <p
              className="px-1 text-[11px] tabular-nums text-muted-foreground"
              title={new Date(m.createdAt).toLocaleString()}
            >
              {outbound ? (m.label || 'Sent') : m.label || 'Customer'} · {formatMessageTime(m.createdAt)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
