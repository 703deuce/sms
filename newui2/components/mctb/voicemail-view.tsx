'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Phone, Search, Sparkles, Voicemail } from 'lucide-react'
import { Avatar, EmptyState } from '@/components/app/primitives'
import { buttonVariants } from '@/components/ui/button'
import { conversations, voicemails } from '@/lib/data'
import { cn } from '@/lib/utils'

export function VoicemailView() {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(voicemails[0]?.id)
  const q = query.trim().toLowerCase()
  const list = voicemails.filter((v) => !q || v.caller.toLowerCase().includes(q) || v.transcript.toLowerCase().includes(q))
  const selected = voicemails.find((v) => v.id === selectedId)
  const convo = selected && conversations.find((c) => c.number === selected.number)

  if (voicemails.length === 0)
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Voicemail}
          title="No voicemails yet"
          description="When callers leave a message, recordings and AI summaries appear here."
          action={<Link href="/mctb/setup/voicemail" className={buttonVariants()}>Configure voicemail</Link>}
        />
      </div>
    )

  return (
    <div className="grid overflow-hidden rounded-xl border bg-card shadow-[0_1px_2px_rgba(16,18,40,0.04)] md:grid-cols-[320px_1fr]">
      <div className="flex flex-col border-b md:border-r md:border-b-0">
        <div className="border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="vm-search" className="sr-only">Search voicemail</label>
            <input
              id="vm-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search voicemail"
              className="h-9 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
            />
          </div>
        </div>
        <ul className="divide-y">
          {list.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelectedId(v.id)}
                aria-current={v.id === selectedId ? 'true' : undefined}
                className={cn('flex w-full gap-3 px-3 py-3 text-left hover:bg-muted/50', v.id === selectedId && 'bg-accent/60')}
              >
                <Avatar name={v.caller} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{v.caller}</span>
                    {v.isNew && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">New</span>}
                  </div>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{v.summary}</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">
                    {v.time} · {v.duration}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected && (
        <article className="flex flex-col gap-6 p-5 md:p-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Avatar name={selected.caller} className="size-11" />
              <div>
                <h2 className="font-semibold">{selected.caller}</h2>
                <p className="text-sm text-muted-foreground tabular-nums">{selected.number} · {selected.time}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <a href={`tel:${selected.number}`} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
                <Phone aria-hidden="true" /> Call back
              </a>
              {convo && (
                <Link href={`/mctb/conversations?conversation=${convo.id}`} className={buttonVariants({ size: 'sm' })}>
                  <MessageSquare aria-hidden="true" /> Open conversation
                </Link>
              )}
            </div>
          </header>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Original recording · {selected.duration}</h3>
            <audio controls preload="none" className="w-full" aria-label={`Voicemail from ${selected.caller}`}>
              <source src="" type="audio/mpeg" />
            </audio>
          </section>

          <section className="flex flex-col gap-2 rounded-xl bg-accent/60 p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" /> AI summary
            </h3>
            <p className="text-sm text-pretty">{selected.summary}</p>
            <p className="text-[11px] text-muted-foreground">Generated from the transcript. Review the recording before acting.</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">Transcript</h3>
            <p className="text-sm leading-relaxed text-pretty">{selected.transcript}</p>
          </section>
        </article>
      )}
    </div>
  )
}
