'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Bot, CheckCheck, Phone, PhoneMissed, Search, Send } from 'lucide-react'
import { Avatar, StatusPill } from '@/components/app/primitives'
import { Button } from '@/components/ui/button'
import { conversations, missedCalls, type Conversation, type Message } from '@/lib/data'
import { cn } from '@/lib/utils'

const buckets = [
  { key: 'all', label: 'All' },
  { key: 'needs_reply', label: 'Needs reply' },
  { key: 'mine', label: 'Mine' },
  { key: 'unassigned', label: 'Unassigned' },
  { key: 'closed', label: 'Closed' },
]

function filterConvos(filter: string, q: string) {
  const query = q.trim().toLowerCase()
  return conversations.filter((c) => {
    if (query && !c.name.toLowerCase().includes(query) && !c.number.includes(query)) return false
    if (filter === 'needs_reply') return c.needsReply
    if (filter === 'closed') return !c.needsReply && c.tag === 'Booked'
    if (filter === 'unassigned') return c.needsReply
    if (filter === 'mine') return !c.needsReply
    return true
  })
}

export function InboxView() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = params.get('filter') ?? 'all'
  const selectedId = params.get('conversation')
  const [query, setQuery] = useState('')
  const [extra, setExtra] = useState<Record<string, Message[]>>({})

  const list = useMemo(() => filterConvos(filter, query), [filter, query])
  const selected = conversations.find((c) => c.id === selectedId) ?? (selectedId ? undefined : list[0])

  function hrefFor(next: { filter?: string; conversation?: string }) {
    const sp = new URLSearchParams(params.toString())
    if (next.filter !== undefined) {
      if (next.filter === 'all') sp.delete('filter')
      else sp.set('filter', next.filter)
      sp.delete('conversation')
    }
    if (next.conversation) sp.set('conversation', next.conversation)
    const s = sp.toString()
    return `/mctb/conversations${s ? `?${s}` : ''}`
  }

  return (
    <div className="grid h-[calc(100dvh-13rem)] min-h-[520px] overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)] md:grid-cols-[300px_1fr] xl:grid-cols-[300px_1fr_280px]">
      <aside className={cn('flex min-h-0 flex-col border-r', selected && selectedId ? 'hidden md:flex' : 'flex')}>
        <div className="flex flex-col gap-3 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="inbox-search" className="sr-only">
              Search conversations
            </label>
            <input
              id="inbox-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search conversations"
              className="h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
          <nav aria-label="Inbox filters" className="flex gap-1 overflow-x-auto">
            {buckets.map((b) => (
              <Link
                key={b.key}
                href={hrefFor({ filter: b.key })}
                aria-current={filter === b.key ? 'page' : undefined}
                className={cn(
                  'h-7 shrink-0 rounded-md px-2.5 text-xs leading-7 font-medium',
                  filter === b.key ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {b.label}
              </Link>
            ))}
          </nav>
        </div>
        <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
          {list.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">No conversations here.</li>}
          {list.map((c) => (
            <li key={c.id}>
              <Link
                href={hrefFor({ conversation: c.id })}
                aria-current={selected?.id === c.id ? 'true' : undefined}
                className={cn('flex gap-3 px-3 py-3 hover:bg-muted/50', selected?.id === c.id && 'bg-accent/60')}
              >
                <Avatar name={c.name} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>{c.name}</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{c.time}</span>
                  </div>
                  <span className="truncate text-xs text-muted-foreground">{c.preview}</span>
                  {(c.needsReply || c.tag) && (
                    <div className="mt-1 flex gap-1.5">
                      {c.needsReply && <StatusPill tone="primary" className="h-5 px-2 text-[11px]">Needs reply</StatusPill>}
                      {c.tag && <StatusPill tone={c.tag === 'Urgent' ? 'danger' : 'success'} dot={false} className="h-5 px-2 text-[11px]">{c.tag}</StatusPill>}
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      {selected ? (
        <Thread
          key={selected.id}
          convo={selected}
          extra={extra[selected.id] ?? []}
          onBack={() => router.push(hrefFor({ filter }))}
          onSend={(text) =>
            setExtra((prev) => ({
              ...prev,
              [selected.id]: [...(prev[selected.id] ?? []), { from: 'business', text, time: 'Just now', status: 'Delivered' }],
            }))
          }
          hiddenOnMobile={!selectedId}
        />
      ) : (
        <div className="hidden items-center justify-center text-sm text-muted-foreground md:flex">Select a conversation</div>
      )}

      {selected && <ContextPanel convo={selected} />}
    </div>
  )
}

function Thread({
  convo,
  extra,
  onSend,
  onBack,
  hiddenOnMobile,
}: {
  convo: Conversation
  extra: Message[]
  onSend: (text: string) => void
  onBack: () => void
  hiddenOnMobile: boolean
}) {
  const [draft, setDraft] = useState('')
  const messages = [...convo.messages, ...extra]

  function submit() {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <section aria-label={`Conversation with ${convo.name}`} className={cn('min-h-0 flex-col', hiddenOnMobile ? 'hidden md:flex' : 'flex')}>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <button type="button" onClick={onBack} className="flex size-8 items-center justify-center rounded-md hover:bg-muted md:hidden">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="sr-only">Back to list</span>
        </button>
        <Avatar name={convo.name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold">{convo.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{convo.number}</span>
        </div>
        <a href={`tel:${convo.number}`} className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <Phone className="size-4" aria-hidden="true" />
          <span className="sr-only">Call {convo.name}</span>
        </a>
        <Button variant="outline" size="sm">
          <CheckCheck aria-hidden="true" /> Close
        </Button>
      </header>

      <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/30 p-4">
        {messages.map((m, i) => (
          <li key={i} className={cn('flex flex-col', m.from === 'customer' ? 'items-start' : m.from === 'system' ? 'items-center' : 'items-end')}>
            {m.from === 'system' ? (
              <span className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">
                <PhoneMissed className="size-3" aria-hidden="true" /> {m.text}
              </span>
            ) : (
              <>
                <span
                  className={cn(
                    'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm text-pretty',
                    m.from === 'customer' && 'rounded-bl-md border bg-card',
                    m.from === 'business' && 'rounded-br-md bg-primary text-primary-foreground',
                    m.from === 'ai' && 'rounded-br-md bg-sidebar text-sidebar-foreground',
                  )}
                >
                  {m.text}
                </span>
                <span className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                  {m.from === 'ai' && (
                    <>
                      <Bot className="size-3" aria-hidden="true" /> AI Recovery ·
                    </>
                  )}
                  {m.time}
                  {m.status && ` · ${m.status}`}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="flex items-end gap-2 border-t p-3"
      >
        <label htmlFor="composer" className="sr-only">
          Reply
        </label>
        <textarea
          id="composer"
          rows={1}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              submit()
            }
          }}
          placeholder={`Reply to ${convo.name.split(' ')[0]}…`}
          className="max-h-32 min-h-9 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send reply">
          <Send aria-hidden="true" />
        </Button>
      </form>
    </section>
  )
}

function ContextPanel({ convo }: { convo: Conversation }) {
  const missed = missedCalls.find((m) => m.id === convo.missedCallId)
  return (
    <aside aria-label="Contact details" className="hidden min-h-0 flex-col gap-5 overflow-y-auto border-l p-4 xl:flex">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Avatar name={convo.name} className="size-14 text-base" />
        <p className="text-sm font-semibold">{convo.name}</p>
        <p className="text-xs text-muted-foreground tabular-nums">{convo.number}</p>
      </div>
      {missed && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <p className="text-xs font-medium text-muted-foreground">Missed call</p>
          <p className="text-sm">
            {missed.trigger} · {missed.missed}
          </p>
          <Link href={`/mctb/missed-calls/${missed.id}`} className="text-xs font-medium text-primary">
            View missed call
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <p className="text-xs font-medium text-muted-foreground">Collected by AI</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Need</dt>
          <dd className="truncate">{convo.preview}</dd>
          <dt className="text-muted-foreground">Urgency</dt>
          <dd>{convo.tag === 'Urgent' ? 'High' : 'Normal'}</dd>
          <dt className="text-muted-foreground">Consent</dt>
          <dd>Granted</dd>
        </dl>
      </div>
    </aside>
  )
}
