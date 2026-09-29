'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Phone, Search, Sparkles, Voicemail } from 'lucide-react'
import { Button } from '@/newui-transplant/components/ui/button'
import { EmptyState, Initials } from '@/newui-transplant/components/app/kit'
import { ButtonLink } from '@/newui-transplant/components/app/button-link'
import type { Voicemail } from '@/newui-transplant/lib/view-models'
import { cn } from '@/lib/utils'

export function VoicemailBrowser({
  voicemails: voicemailsProp,
  onMarkReviewed,
}: {
  voicemails?: Voicemail[]
  onMarkReviewed?: (id: string) => Promise<void>
}) {
  const source = voicemailsProp ?? []
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(source[0]?.id)

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return source.filter((v) => !q || `${v.caller} ${v.phone} ${v.summary}`.toLowerCase().includes(q))
  }, [query, source])
  const selected = source.find((v) => v.id === selectedId)

  if (!source.length) {
    return (
      <div className="rounded-xl border bg-card">
        <EmptyState
          icon={Voicemail}
          title="No voicemails yet"
          description="When callers leave a message, recordings and AI summaries appear here."
          action={<ButtonLink href="/mctb/setup/voicemail" size="sm">Configure voicemail</ButtonLink>}
        />
      </div>
    )
  }

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
        <ul className="max-h-[520px] divide-y overflow-y-auto">
          {list.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setSelectedId(v.id)}
                aria-current={v.id === selectedId ? 'true' : undefined}
                className={cn('flex w-full gap-3 px-3 py-3 text-left hover:bg-muted/50', v.id === selectedId && 'bg-accent/60')}
              >
                <Initials name={v.caller} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{v.caller}</span>
                    {v.isNew ? (
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">New</span>
                    ) : null}
                  </div>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{v.summary}</span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {v.time} · {v.duration}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {selected ? (
        <article aria-label="Voicemail detail" className="flex flex-col gap-6 p-5 md:p-6">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Initials name={selected.caller} className="size-11" />
              <div>
                <h2 className="font-semibold">{selected.caller}</h2>
                <p className="font-mono text-xs text-muted-foreground">{selected.phone} · {selected.time}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" render={<a href={`tel:${selected.phone}`} />} nativeButton={false}>
                <Phone /> Call back
              </Button>
              <Button
                size="sm"
                render={<Link href={selected.conversationHref ?? '/mctb/conversations'} />}
                nativeButton={false}
              >
                <MessageSquare /> Open conversation
              </Button>
              {onMarkReviewed && selected.isNew ? (
                <Button variant="outline" size="sm" type="button" onClick={() => void onMarkReviewed(selected.id)}>
                  Mark reviewed
                </Button>
              ) : null}
            </div>
          </header>

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Original recording · {selected.duration}</h3>
            <audio
              controls
              preload="none"
              className="w-full"
              aria-label={`Voicemail from ${selected.caller}`}
              src={selected.recordingSrc}
            />
          </div>

          <div className="rounded-lg bg-accent/50 p-4">
            <h3 className="flex items-center gap-1.5 text-xs font-medium text-accent-foreground">
              <Sparkles className="size-3.5" aria-hidden="true" /> AI summary
            </h3>
            <p className="mt-1.5 text-pretty text-sm">{selected.summary}</p>
            <p className="mt-2 text-[11px] text-muted-foreground">Generated from the recording and may contain mistakes.</p>
          </div>

          <div>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Transcript</h3>
            {selected.transcript ? (
              <p className="text-pretty text-sm leading-relaxed">{selected.transcript}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Transcript is still processing…</p>
            )}
          </div>
        </article>
      ) : null}
    </div>
  )
}
