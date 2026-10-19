'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { FileText, Globe, Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Panel } from '@/components/app/page-primitives'
import { SegmentedFilter } from '@/components/app/filters'
import { StatusBadge } from '@/components/app/status'
import {
  addReceptionistWebsiteSource,
  fetchReceptionistKnowledgeFaqs,
  fetchReceptionistKnowledgeGaps,
  fetchReceptionistKnowledgeSources,
  resolveReceptionistGap,
} from '@/lib/receptionist-api'
import { formatWhen } from '@/lib/format'

type Tab = 'faqs' | 'sources' | 'gaps'

type FaqRow = { id: string; q: string; a: string; status: string; source: string }
type GapRow = { id: string; question: string; count: number; impact: string; lastCallId: string | null }
type SourceRow = { id: string; name: string; type: string; status: string; updatedAt: string }

const SOURCE_TONE = { synced: 'success', ready: 'success', stale: 'warning', failed: 'danger', pending: 'warning' } as const

export function KnowledgeManager() {
  const [tab, setTab] = useState<Tab>('gaps')
  const [faqs, setFaqs] = useState<FaqRow[]>([])
  const [gaps, setGaps] = useState<GapRow[]>([])
  const [sources, setSources] = useState<SourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [f, g, s] = await Promise.all([
        fetchReceptionistKnowledgeFaqs(),
        fetchReceptionistKnowledgeGaps(),
        fetchReceptionistKnowledgeSources(),
      ])
      setFaqs(f)
      setGaps(g)
      setSources(s)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load knowledge')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const resolveGap = async (id: string) => {
    if (!answer.trim()) return
    try {
      await resolveReceptionistGap(id, answer.trim())
      setAnswering(null)
      setAnswer('')
      toast.success('Answer published', { description: 'Ava will use it on the next call.' })
      await reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish answer')
    }
  }

  const addWebsite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!websiteUrl.trim()) return
    try {
      await addReceptionistWebsiteSource(websiteUrl.trim())
      setWebsiteUrl('')
      toast.success('Crawl queued', { description: 'We will index this URL for Ava.' })
      await reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add source')
    }
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
          { value: 'sources', label: 'Sources', count: sources.length },
        ]}
      />

      {loading && <p className="text-sm text-muted-foreground">Loading knowledge…</p>}

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
                        {g.lastCallId ? (
                          <Link href={`/app/receptionist/calls/${g.lastCallId}`} className="hover:text-foreground hover:underline">
                            latest call
                          </Link>
                        ) : (
                          'no linked call'
                        )}
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
                        <Button size="sm" disabled={!answer.trim()} onClick={() => void resolveGap(g.id)}>Publish answer</Button>
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
        <Panel title="FAQs" bodyClassName="p-0">
          <ul className="divide-y">
            {faqs.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No FAQs yet. Resolve a gap or add content in Sources.</li>}
            {faqs.map((f) => (
              <li key={f.id} className="flex flex-col gap-1 px-5 py-4">
                <span className="flex items-center gap-2">
                  <span className="flex-1 text-sm font-medium">{f.q}</span>
                  <StatusBadge tone={f.status === 'published' || f.status === 'ready' ? 'success' : 'muted'}>{f.status}</StatusBadge>
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
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={addWebsite}>
              <Label htmlFor="src-url" className="sr-only">Website URL</Label>
              <Input id="src-url" type="url" required placeholder="https://yourwebsite.com/page" className="flex-1" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              <Button type="submit">Add website</Button>
            </form>
          </Panel>
          <Panel title="Sources" bodyClassName="p-0">
            <ul className="divide-y">
              {sources.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">No sources yet.</li>}
              {sources.map((s) => {
                const Icon = s.type === 'website' ? Globe : FileText
                const tone = SOURCE_TONE[s.status as keyof typeof SOURCE_TONE] || 'muted'
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">Updated {formatWhen(s.updatedAt)}</span>
                    </span>
                    <StatusBadge tone={tone}>{s.status}</StatusBadge>
                    <Button size="icon-sm" variant="ghost" aria-label={`Refresh ${s.name}`} onClick={() => void reload()}>
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
