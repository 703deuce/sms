'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

type Message = { id: string; role: 'customer' | 'agent'; text: string; timestamp: string }
type Version = { jobId: string; revision: number; createdAt: string }

export function AgentChatPanel({ projectId, selectedElementIds, selectedTimeMs }: {
  projectId: string; selectedElementIds?: string[]; selectedTimeMs?: number | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [liveJob, setLiveJob] = useState<{status:string; phase:string; progress:number; message?:string; events?:{id:number;message:string;timestamp:string}[]} | null>(null)
  const reload = useCallback(async () => {
    const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId) + '/chat', {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Could not load your conversation.')
    const data = await response.json() as { messages: Message[]; versions: Version[]; activeJobId: string | null }
    setMessages(data.messages ?? [])
    setVersions(data.versions ?? [])
    setActiveJobId(data.activeJobId ?? null)
    const jobResponse = await fetch('/api/motion-studio/agent/jobs?projectId=' + encodeURIComponent(projectId),
      {cache:'no-store'})
    if (jobResponse.ok) {
      const jobs = await jobResponse.json() as {job?: typeof liveJob}
      setLiveJob(jobs.job ?? null)
    }
  }, [projectId])
  useEffect(() => {
    let active = true
    const load = () => { if (active) void reload().catch(() => {/* brief network failures are retried */}) }
    load()
    const timer = window.setInterval(load, 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [reload])

  const restore = async (jobId: string) => {
    if (restoring) return
    setRestoring(jobId)
    setError(null)
    try {
      const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId)
        + '/versions/' + encodeURIComponent(jobId) + '/restore', { method: 'POST' })
      if (!response.ok) throw new Error('Could not restore that version.')
      await reload()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore that version.')
    } finally { setRestoring(null) }
  }

  const send = async () => {
    const instruction = draft.trim()
    if (!instruction || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId) + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json',
          'Idempotency-Key': 'ms_revision_' + crypto.randomUUID() },
        body: JSON.stringify({ instruction, selectedElementIds: selectedElementIds ?? [],
          ...(selectedTimeMs != null && Number.isFinite(selectedTimeMs) ? {
            timeRangeMs: [Math.max(0,Math.floor(selectedTimeMs)),Math.floor(selectedTimeMs)+1000] } : {}) }),
      })
      if (!response.ok) throw new Error('We could not send that change yet. Please try again.')
      setDraft('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the edit.')
    } finally { setBusy(false) }
  }

  return <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
    aria-label="Transovo Agent editing conversation" data-testid="ms-agent-chat">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4" /> Transovo Agent</h3>
      {versions.length > 0 ? <button type="button" className="text-xs text-muted-foreground underline"
        onClick={() => setShowVersions(v => !v)}>Versions ({versions.length})</button> : null}
    </div>
    {showVersions ? <ol className="space-y-1 rounded-md bg-muted p-3 text-xs">
      {versions.map(v => <li key={v.jobId} className="flex items-center justify-between gap-2">
        <span>Version {v.revision + 1} · {new Date(v.createdAt).toLocaleDateString()}
          {activeJobId === v.jobId ? ' · Current' : ''}</span>
        {activeJobId !== v.jobId ? <button type="button" onClick={() => void restore(v.jobId)}
          disabled={restoring != null} className="text-primary underline">
          {restoring === v.jobId ? 'Restoring…' : 'Restore'}
        </button> : null}
      </li>)}
    </ol> : null}
    {liveJob && !['complete','failed','cancelled','dispatch_failed'].includes(liveJob.status) ?
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs" role="status">
        <p className="font-medium">We're working on your edit · {Math.round(liveJob.progress)}%</p>
        <p className="mt-1 text-muted-foreground">{liveJob.message || "We're preparing your changes…"}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{width:liveJob.progress+'%'}} />
        </div>
        <ol className="mt-2 max-h-28 overflow-y-auto space-y-1 text-muted-foreground">
          {(liveJob.events??[]).slice(-5).map(e=><li key={e.id}>{e.message}</li>)}
        </ol>
      </div> : null}
    <ol className="max-h-80 min-h-20 space-y-3 overflow-y-auto" aria-live="polite">
      {messages.map(m => <li key={m.id} className={m.role === 'customer'
        ? 'ml-6 rounded-xl bg-primary/10 px-3 py-2 text-sm'
        : 'mr-6 rounded-xl bg-muted px-3 py-2 text-sm'}>
        <span className="mb-1 block text-xs font-semibold">{m.role === 'customer' ? 'You' : 'Transovo Agent'}</span>
        <span className="whitespace-pre-wrap break-words">{m.text}</span>
      </li>)}
      {!messages.length ? <li className="text-sm text-muted-foreground">
        Ask us to replace a scene, change a card, adjust music, or add footage.
      </li> : null}
    </ol>
    <label className="sr-only" htmlFor={'ms-agent-instruction-' + projectId}>Tell Transovo what to change</label>
    <Textarea id={'ms-agent-instruction-' + projectId} value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault(); void send()} }}
      placeholder="At 1:36, change that title…" rows={3} maxLength={2500} />
    {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    <Button size="sm" onClick={() => void send()} disabled={busy || !draft.trim()}>
      {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
      Send edit
    </Button>
  </section>
}
