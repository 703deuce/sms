'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Ban, Phone, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { SearchInput, SegmentedFilter } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { useWorkspace } from '@/components/providers/workspace-provider'
import { NUMBERS, THREADS, getContact, type Thread } from '@/lib/data'
import { formatPhone, formatWhen, initials } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = 'all' | 'needs_reply' | 'unread' | 'mine'

const KIND_LABEL: Record<Thread['kind'], string> = { mctb: 'Missed call', ai_followup: 'AI follow-up', direct: 'Direct' }

export function ThreadWorkspace({ kind, initialId }: { kind?: Thread['kind']; initialId?: string }) {
  const { startCall } = useWorkspace()
  const [threads, setThreads] = useState(() => THREADS.filter((t) => !kind || t.kind === kind))
  const [filter, setFilter] = useState<Filter>('needs_reply')
  const [query, setQuery] = useState('')
  const [activeId, setActiveId] = useState<string | undefined>(initialId ?? threads[0]?.id)
  const [draft, setDraft] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return threads.filter((t) => {
      const c = getContact(t.contactId)
      if (q && !`${c?.name} ${c?.phone} ${t.messages.at(-1)?.text}`.toLowerCase().includes(q)) return false
      if (filter === 'needs_reply') return t.needsReply
      if (filter === 'unread') return t.unread
      if (filter === 'mine') return t.owner === 'Maya Okafor'
      return true
    })
  }, [threads, filter, query])

  const active = threads.find((t) => t.id === activeId)
  const contact = active ? getContact(active.contactId) : undefined
  const sender = NUMBERS.find((n) => n.sms && n.status === 'active')

  const open = (id: string) => {
    setActiveId(id)
    setThreads((xs) => xs.map((t) => (t.id === id ? { ...t, unread: false } : t)))
  }

  const send = () => {
    if (!active || !draft.trim()) return
    setThreads((xs) =>
      xs.map((t) =>
        t.id === active.id
          ? { ...t, needsReply: false, messages: [...t.messages, { from: 'business', text: draft.trim(), at: new Date().toISOString() }] }
          : t,
      ),
    )
    setDraft('')
    toast.success('Message sent', { description: `From ${sender ? formatPhone(sender.number) : 'Main line'}` })
  }

  return (
    <div className="grid min-h-[36rem] grid-cols-1 overflow-hidden rounded-xl surface md:grid-cols-[20rem_1fr] xl:grid-cols-[20rem_1fr_16rem]">
      <div className={cn('flex flex-col border-r', active && 'hidden md:flex')}>
        <div className="flex flex-col gap-3 border-b p-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Search conversations" />
          <SegmentedFilter
            label="Conversation filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'needs_reply', label: 'Needs reply', count: threads.filter((t) => t.needsReply).length },
              { value: 'unread', label: 'Unread' },
              { value: 'mine', label: 'Mine' },
              { value: 'all', label: 'All' },
            ]}
          />
        </div>
        <ul className="flex-1 divide-y overflow-y-auto" aria-label="Conversations">
          {visible.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing here.</li>}
          {visible.map((t) => {
            const c = getContact(t.contactId)
            const last = t.messages.at(-1)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => open(t.id)}
                  aria-current={t.id === activeId}
                  className={cn('flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/60', t.id === activeId && 'bg-accent/60')}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium">{initials(c?.name ?? '?')}</span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex items-center gap-2">
                      <span className={cn('flex-1 truncate text-sm', t.unread ? 'font-semibold' : 'font-medium')}>{c?.name}</span>
                      <span className="text-[11px] text-muted-foreground">{last && formatWhen(last.at)}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{last?.text}</span>
                    <span className="flex gap-1.5 pt-0.5">
                      <StatusBadge tone="muted">{KIND_LABEL[t.kind]}</StatusBadge>
                      {t.needsReply && <StatusBadge tone="warning">Needs reply</StatusBadge>}
                      {t.optedOut && <StatusBadge tone="danger">Opted out</StatusBadge>}
                    </span>
                  </span>
                  {t.unread && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {active && contact ? (
        <section className="flex min-w-0 flex-col" aria-label={`Conversation with ${contact.name}`}>
          <header className="flex items-center gap-3 border-b px-4 py-3">
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label="Back to conversations" onClick={() => setActiveId(undefined)}>
              <ArrowLeft />
            </Button>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{contact.name}</span>
              <span className="text-xs text-muted-foreground">{formatPhone(contact.phone)} · via {active.source}</span>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startCall({ name: contact.name, number: contact.phone, callerId: sender?.number ?? NUMBERS[0].number })}
            >
              <Phone />
              Call
            </Button>
          </header>
          <ol className="flex flex-1 flex-col gap-3 overflow-y-auto bg-muted/30 p-4" aria-live="polite">
            {active.messages.map((m, i) =>
              m.from === 'system' ? (
                <li key={i} className="self-center rounded-full bg-secondary px-3 py-1 text-center text-[11px] text-muted-foreground">
                  {m.text} · {formatWhen(m.at)}
                </li>
              ) : (
                <li key={i} className={cn('flex max-w-[80%] flex-col gap-1', m.from === 'business' ? 'self-end items-end' : 'self-start')}>
                  <span
                    className={cn(
                      'rounded-2xl px-3 py-2 text-sm leading-relaxed',
                      m.from === 'business' ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-card',
                    )}
                  >
                    {m.text}
                  </span>
                  <span className="text-[11px] text-muted-foreground">{formatWhen(m.at)}</span>
                </li>
              ),
            )}
          </ol>
          <div className="border-t p-3">
            {active.optedOut ? (
              <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Ban className="size-4" aria-hidden />
                This contact replied STOP. Texting is disabled until they opt back in.
              </p>
            ) : (
              <form
                className="flex items-end gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <label htmlFor="composer" className="sr-only">Message</label>
                <Textarea
                  id="composer"
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) {
                      e.preventDefault()
                      send()
                    }
                  }}
                  placeholder="Type a reply…"
                  className="min-h-10 flex-1 resize-none"
                />
                <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send">
                  <Send />
                </Button>
              </form>
            )}
          </div>
        </section>
      ) : (
        <div className="hidden items-center justify-center p-8 text-sm text-muted-foreground md:flex">Select a conversation</div>
      )}

      {active && contact && (
        <aside className="hidden flex-col gap-4 border-l p-4 text-sm xl:flex">
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Contact</span>
            <Link href={`/app/contacts/${contact.id}`} className="font-medium hover:underline">{contact.name}</Link>
            {contact.company && <span className="text-xs text-muted-foreground">{contact.company}</span>}
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Owner</span>
            <span>{active.owner ?? 'Unassigned'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Consent</span>
            <span>{active.optedOut ? 'Opted out' : contact.consent === 'opted_in' ? 'Opted in' : 'Unknown'}</span>
          </div>
          {active.callId && (
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Originating call</span>
              <Link href={`/app/calls/${active.callId}`} className="font-medium text-primary hover:underline">
                View call
              </Link>
              {active.attribution === 'unresolved' && <span className="text-xs text-warning-foreground">Attribution unresolved</span>}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={!active.needsReply}
            onClick={() => setThreads((xs) => xs.map((t) => (t.id === active.id ? { ...t, needsReply: false } : t)))}
          >
            Mark resolved
          </Button>
        </aside>
      )}
    </div>
  )
}
