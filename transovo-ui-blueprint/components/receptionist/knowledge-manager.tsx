'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { FileText, Globe, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { SegmentedFilter } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import { FAQS, GAPS, SOURCES } from '@/lib/data'
import { formatWhen } from '@/lib/format'

type Tab = 'faqs' | 'sources' | 'gaps'

const SOURCE_TONE = { synced: 'success', stale: 'warning', failed: 'danger' } as const

export function KnowledgeManager() {
  const [tab, setTab] = useState<Tab>('gaps')
  const [faqs, setFaqs] = useState(FAQS)
  const [gaps, setGaps] = useState(GAPS)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')

  const resolveGap = (id: string) => {
    const g = gaps.find((x) => x.id === id)
    if (!g || !answer.trim()) return
    setFaqs((f) => [{ id: `f${Date.now()}`, q: g.question, a: answer.trim(), status: 'published', source: 'Knowledge gap' }, ...f])
    setGaps((xs) => xs.filter((x) => x.id !== id))
    setAnswering(null)
    setAnswer('')
    toast.success('Answer published', { description: 'Ava will use it on the next call.' })
  }

  return (
    <div className="flex flex-col gap-4">
      <SegmentedFilter
        label="Knowledge view"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'gaps', label: 'Gaps', count: gaps.length },
          { value: 'faqs', label: 'FAQs', count: faqs.length },
          { value: 'sources', label: 'Sources', count: SOURCES.length },
        ]}
      />

      {tab === 'gaps' && (
        <Panel title="Unanswered questions" description="Callers asked these and Ava had no approved answer" bodyClassName="p-0">
          {gaps.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">No open gaps. Nice work.</p>
          ) : (
            <ul className="divide-y">
              {gaps.map((g) => (
                <li key={g.id} className="flex flex-col gap-3 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-sm font-medium text-pretty">{g.question}</span>
                      <span className="text-xs text-muted-foreground">
                        Asked {g.count}× ·{' '}
                        <Link href={`/app/receptionist/calls/${g.lastCallId}`} className="hover:text-foreground hover:underline">
                          latest call
                        </Link>
                      </span>
                    </span>
                    <StatusBadge tone={g.impact === 'high' ? 'danger' : g.impact === 'medium' ? 'warning' : 'muted'}>{g.impact} impact</StatusBadge>
                    {answering !== g.id && (
                      <Button size="sm" variant="outline" onClick={() => (setAnswering(g.id), setAnswer(''))}>
                        Answer
                      </Button>
                    )}
                  </div>
                  {answering === g.id && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`ans-${g.id}`} className="sr-only">Answer</Label>
                      <Textarea id={`ans-${g.id}`} autoFocus rows={3} placeholder="Write the approved answer Ava should give…" value={answer} onChange={(e) => setAnswer(e.target.value)} />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setAnswering(null)}>Cancel</Button>
                        <Button size="sm" disabled={!answer.trim()} onClick={() => resolveGap(g.id)}>Publish answer</Button>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}

      {tab === 'faqs' && (
        <Panel
          title="FAQs"
          bodyClassName="p-0"
          actions={
            <Button size="sm" variant="outline" onClick={() => setTab('gaps')}>
              <Plus />
              Add FAQ
            </Button>
          }
        >
          <ul className="divide-y">
            {faqs.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 px-5 py-4">
                <span className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{f.q}</span>
                  <StatusBadge tone={f.status === 'published' ? 'success' : 'muted'}>{f.status === 'published' ? 'Published' : 'Draft'}</StatusBadge>
                </span>
                <span className="text-sm leading-relaxed text-muted-foreground">{f.a}</span>
                <span className="text-xs text-muted-foreground">Source: {f.source}</span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {tab === 'sources' && (
        <div className="flex flex-col gap-4">
          <Panel title="Add a source">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault()
                toast.success('Crawling started', { description: "We'll notify you when it's processed." })
              }}
            >
              <Label htmlFor="src-url" className="sr-only">Website URL</Label>
              <Input id="src-url" type="url" required placeholder="https://yourwebsite.com/page" className="flex-1" />
              <Button type="submit">Add website</Button>
              <Button type="button" variant="outline">Upload file</Button>
            </form>
          </Panel>
          <Panel title="Sources" bodyClassName="p-0">
            <ul className="divide-y">
              {SOURCES.map((s) => {
                const Icon = s.kind === 'Website' ? Globe : FileText
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.items} items · processed {formatWhen(s.lastProcessed)}
                      </span>
                    </span>
                    <StatusBadge tone={SOURCE_TONE[s.status as keyof typeof SOURCE_TONE]}>{s.status}</StatusBadge>
                    <Button size="icon-sm" variant="ghost" aria-label={`Re-sync ${s.name}`} onClick={() => toast('Re-sync queued')}>
                      <RefreshCw />
                    </Button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  )
}
