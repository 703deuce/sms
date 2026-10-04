'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

export type MctbDetailThreadMessage = {
  from: 'customer' | 'business' | 'ai'
  text: string
  at: string
}

function formatMessageTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

function senderLabel(from: MctbDetailThreadMessage['from']): string {
  if (from === 'customer') return 'Caller'
  if (from === 'ai') return 'AI Recovery'
  return 'Transovo'
}

export function MctbDetailConversationThread({
  messages,
  conversationHref,
  emptyHint,
}: {
  messages: MctbDetailThreadMessage[]
  conversationHref?: string
  emptyHint: string
}) {
  if (!messages.length) {
    return <p className="text-sm text-muted-foreground">{emptyHint}</p>
  }

  return (
    <div className="space-y-4">
      <ul className="flex flex-col gap-3" aria-label="SMS recovery conversation">
        {messages.map((m, i) => {
          const outbound = m.from !== 'customer'
          return (
            <li
              key={`${m.at}-${i}`}
              className={cn('flex flex-col gap-1', outbound ? 'items-end' : 'items-start')}
            >
              <span className="text-[11px] font-medium text-muted-foreground">{senderLabel(m.from)}</span>
              <span
                className={cn(
                  'max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                  m.from === 'customer'
                    ? 'rounded-bl-md border bg-card text-foreground'
                    : m.from === 'ai'
                      ? 'rounded-br-md bg-sidebar text-sidebar-foreground'
                      : 'rounded-br-md bg-primary text-primary-foreground',
                )}
              >
                {m.text}
              </span>
              {m.at ? (
                <time className="text-[11px] text-muted-foreground" dateTime={m.at}>
                  {formatMessageTime(m.at)}
                </time>
              ) : null}
            </li>
          )
        })}
      </ul>
      {conversationHref && messages.length >= 40 ? (
        <Link href={conversationHref} className="text-sm font-medium text-primary hover:underline">
          Open full conversation →
        </Link>
      ) : null}
    </div>
  )
}
