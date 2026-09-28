'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, CheckCheck, Inbox as InboxIcon, Phone, PhoneMissed, Search, SendHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { Checkbox } from '@/newui-transplant/components/ui/checkbox'
import { Input } from '@/newui-transplant/components/ui/input'
import { Textarea } from '@/newui-transplant/components/ui/textarea'
import { EmptyState, Initials, Pill } from '@/newui-transplant/components/app/kit'
import { BUSINESS, CONVERSATIONS, MISSED_CALLS } from '@/newui-transplant/lib/sandbox-data'
import type { BusinessContext, Conversation, Message, MissedCall } from '@/newui-transplant/lib/view-models'
import { cn } from '@/lib/utils'

const FILTERS = ['All', 'Needs reply', 'Mine', 'Unassigned', 'Closed', 'Spam'] as const
type Filter = (typeof FILTERS)[number]

export type InboxWiring = {
  filter?: Filter
  onFilterChange?: (filter: Filter) => void
  onSelectionChange?: (conversationId: string) => void
  onMarkRead?: (ids: string[]) => Promise<void>
  onClose?: (ids: string[]) => Promise<void>
  onSendMessage?: (conversationId: string, text: string) => Promise<void>
}

function Bubble({ m }: { m: Message }) {
  if (m.from === 'system') {
    return (
      <li className="mx-auto max-w-md rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Compliance · </span>
        {m.text}
      </li>
    )
  }
  const outbound = m.from !== 'customer'
  return (
    <li className={cn('flex flex-col gap-1', outbound ? 'items-end' : 'items-start')}>
      <span
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          outbound ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-muted',
        )}
      >
        {m.text}
      </span>
      <span className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        {m.urgentReply ? <Pill tone="warning">Urgent</Pill> : null}
        {m.from === 'ai' ? (
          <>
            <Sparkles className="size-3" aria-hidden="true" /> AI Recovery ·
          </>
        ) : null}
        {m.time}
        {outbound && m.status ? (
          <>
            {' · '}
            <CheckCheck className="size-3" aria-hidden="true" /> {m.status}
          </>
        ) : null}
      </span>
    </li>
  )
}

export function Inbox({
  initialId,
  initialFilter,
  conversations: conversationsProp,
  missedCalls: missedCallsProp,
  business: businessProp,
  onSendMessage,
  wiring,
  threadLoadingId,
}: {
  initialId?: string
  initialFilter: Filter
  conversations?: Conversation[]
  missedCalls?: MissedCall[]
  business?: BusinessContext
  onSendMessage?: (conversationId: string, text: string) => Promise<void>
  threadLoadingId?: string | null
  wiring?: InboxWiring
}) {
  const production = Boolean(wiring)
  const conversations = conversationsProp ?? (production ? [] : CONVERSATIONS)
  const missedCalls = missedCallsProp ?? (production ? [] : MISSED_CALLS)
  const business = businessProp ?? (production ? { line: '—', sender: '—', name: '—' } : BUSINESS)

  const [filterLocal, setFilterLocal] = useState<Filter>(initialFilter)
  const filter = wiring?.filter ?? filterLocal
  const setFilter = wiring?.onFilterChange ?? setFilterLocal
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | undefined>(initialId ?? conversations[0]?.id)
  const [mobileThread, setMobileThread] = useState(Boolean(initialId))
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [sent, setSent] = useState<Record<string, Message[]>>({})
  const [draft, setDraft] = useState('')

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return conversations.filter((c) => {
      if (wiring) {
        return !q || `${c.name} ${c.phone} ${c.preview}`.toLowerCase().includes(q)
      }
      if (filter === 'Needs reply' && !c.needsReply) return false
      if (filter === 'Closed' || filter === 'Spam') return false
      return !q || `${c.name} ${c.phone} ${c.preview}`.toLowerCase().includes(q)
    })
  }, [filter, query, conversations, wiring])

  const selected: Conversation | undefined = conversations.find((c) => c.id === selectedId)
  const messages = selected ? [...selected.messages, ...(sent[selected.id] ?? [])] : []
  const missed = selected ? missedCalls.find((m) => m.conversationId === selected.id) : undefined

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const send = async () => {
    const text = draft.trim()
    if (!text || !selected) return
    const sendHandler = wiring?.onSendMessage ?? onSendMessage
    if (sendHandler) {
      await sendHandler(selected.id, text)
    }
    setSent((prev) => ({
      ...prev,
      [selected.id]: [...(prev[selected.id] ?? []), { from: 'business', text, time: 'Just now', status: 'Sent' }],
    }))
    setDraft('')
  }

  return (
    <main className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-col">
      <div className="flex items-center gap-2 overflow-x-auto border-b bg-card px-4 py-2 md:px-6">
        <h1 className="mr-2 text-sm font-semibold">Inbox</h1>
        <div role="tablist" aria-label="Conversation filters" className="flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              role="tab"
              type="button"
              aria-selected={filter === f}
              onClick={() => setFilter(f)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                filter === f ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {f}
              {f === 'Needs reply' ? (
                <span className="ml-1.5 tabular-nums text-muted-foreground">{conversations.filter((c) => c.needsReply).length}</span>
              ) : null}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden text-xs text-muted-foreground md:inline">Missed Call Text Back</span>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[320px_1fr] xl:grid-cols-[320px_1fr_280px]">
        <aside className={cn('flex min-h-0 flex-col border-r bg-card', mobileThread && 'hidden md:flex')}>
          <div className="border-b p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" aria-label="Search conversations" className="pl-8" />
            </div>
            {checked.size ? (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{checked.size} selected</span>
                <Button
                  size="xs"
                  variant="outline"
                  className="ml-auto"
                  type="button"
                  onClick={() => void wiring?.onMarkRead?.([...checked])}
                >
                  Mark read
                </Button>
                <Button size="xs" variant="outline" type="button" onClick={() => void wiring?.onClose?.([...checked])}>
                  Close
                </Button>
              </div>
            ) : null}
          </div>
          {list.length ? (
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
              {list.map((c) => (
                <li key={c.id} className={cn('flex items-start gap-2 px-3 py-3', c.id === selectedId && 'bg-accent/60')}>
                  <Checkbox
                    checked={checked.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    aria-label={`Select ${c.name}`}
                    className="mt-2"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(c.id)
                      setMobileThread(true)
                      wiring?.onSelectionChange?.(c.id)
                    }}
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    aria-current={c.id === selectedId}
                  >
                    <Initials name={c.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm', c.unread ? 'font-semibold' : 'font-medium')}>{c.name}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{c.preview}</span>
                      {c.needsReply || c.tag || c.mctbUrgent?.isUrgent ? (
                        <span className="mt-1.5 flex flex-wrap gap-1">
                          {c.mctbUrgent?.isUrgent ? <Pill tone="warning">Urgent</Pill> : null}
                          {c.needsReply ? <Pill tone="warning">Needs reply</Pill> : null}
                          {c.tag ? <Pill tone="neutral" dot={false}>{c.tag}</Pill> : null}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={InboxIcon} title="No conversations" description="Nothing matches this filter right now." />
          )}
        </aside>

        <section aria-label="Conversation thread" className={cn('flex min-h-0 flex-col bg-background', !mobileThread && 'hidden md:flex')}>
          {selected ? (
            <>
              <header className="flex items-center gap-3 border-b bg-card px-4 py-3">
                <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={() => setMobileThread(false)} aria-label="Back to list">
                  <ArrowLeft />
                </Button>
                <Initials name={selected.name} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 truncate text-sm font-semibold">
                    {selected.name}
                    {selected.mctbUrgent?.isUrgent ? <Pill tone="warning">Urgent</Pill> : null}
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{selected.phone}</p>
                </div>
                <Button variant="outline" size="sm" render={<a href={`tel:${selected.phone}`} />} nativeButton={false}>
                  <Phone /> Call
                </Button>
              </header>
              <ol className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5">
                {production &&
                threadLoadingId === selected.id &&
                messages.length === 0 ? (
                  <li className="py-8 text-center text-sm text-muted-foreground">Loading messages…</li>
                ) : null}
                {messages.map((m, i) => (
                  <Bubble key={i} m={m} />
                ))}
              </ol>
              <form
                className="border-t bg-card p-3"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <label htmlFor="composer" className="sr-only">Reply</label>
                <div className="flex items-end gap-2 rounded-xl border bg-background p-2 focus-within:ring-2 focus-within:ring-ring/40">
                  <Textarea
                    id="composer"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        send()
                      }
                    }}
                    rows={1}
                    placeholder={`Reply from ${business.sender}`}
                    className="min-h-9 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
                    <SendHorizontal />
                  </Button>
                </div>
                <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
                  {selected.composerFooter ?? `${draft.length} / 160 · 1 segment · Customer has not opted out`}
                </p>
              </form>
            </>
          ) : (
            <EmptyState icon={InboxIcon} title="Select a conversation" description="Choose a conversation from the list to read and reply." />
          )}
        </section>

        <aside aria-label="Contact context" className="hidden min-h-0 overflow-y-auto border-l bg-card p-4 xl:block">
          {selected ? (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col items-center text-center">
                <Initials name={selected.name} className="size-12 text-sm" />
                <p className="mt-2 text-sm font-semibold">{selected.name}</p>
                <p className="font-mono text-xs text-muted-foreground">{selected.phone}</p>
              </div>
              {selected.mctbUrgent?.isUrgent ? (
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <Pill tone="warning">Urgent</Pill>
                    <span className="text-muted-foreground">Inbound reply</span>
                  </p>
                  {selected.mctbUrgent.summary || selected.mctbUrgent.reason ? (
                    <p className="mt-2 text-xs leading-relaxed text-foreground">
                      {selected.mctbUrgent.summary || selected.mctbUrgent.reason}
                    </p>
                  ) : null}
                  {selected.mctbUrgent.reason && selected.mctbUrgent.summary ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">{selected.mctbUrgent.reason}</p>
                  ) : null}
                </div>
              ) : null}
              {missed ? (
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <PhoneMissed className="size-3.5 text-destructive" aria-hidden="true" /> Missed call
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{missed.missed} · {missed.trigger}</p>
                  <Link href={`/mctb/missed-calls/${missed.id}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                    View missed call
                  </Link>
                </div>
              ) : null}
              <dl className="flex flex-col gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Business line</dt>
                  <dd className="mt-0.5 font-mono">{business.line}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Consent</dt>
                  <dd className="mt-0.5">{selected.consentLabel ?? '—'}</dd>
                </div>
                {!production && selected.assignedTo ? (
                  <div>
                    <dt className="text-muted-foreground">Assigned to</dt>
                    <dd className="mt-0.5">{selected.assignedTo}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : null}
        </aside>
      </div>
    </main>
  )
}
