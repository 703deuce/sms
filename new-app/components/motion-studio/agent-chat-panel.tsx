'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Send, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { AGENT_JOB_CHANGED_EVENT, PollHttpError, agentJobIsActive, fetchAgentJobShared, notifyAgentJobChanged, startPolling } from '@/lib/motion-studio/poll'

type Message = { id: string; role: 'customer' | 'agent'; text: string; timestamp: string }
type Version = { jobId: string; revision: number; createdAt: string }

export function AgentChatPanel({ projectId, selectedElementIds, selectedTimeMs }: {
  projectId: string; selectedElementIds?: string[]; selectedTimeMs?: number | null
}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [versions, setVersions] = useState<Version[]>([])
  const [versionsLoaded, setVersionsLoaded] = useState(false)
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const pendingSubmission = useRef<{ text: string; key: string } | null>(null)
  const [answerQuestion, setAnswerQuestion] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [liveJob, setLiveJob] = useState<{status:string; phase:string; progress:number; updatedAt?:string; waitingStartedAt?:string | null; message?:string; events?:{id:number;message:string;timestamp:string}[]} | null>(null)
  const reload = useCallback(async (opts: { fresh?: boolean } = {}): Promise<boolean> => {
    const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId) + '/chat', {
      cache: 'no-store',
    })
    if (!response.ok) throw new PollHttpError(response.status)
    const data = await response.json() as { messages: Message[]; versions: Version[]; activeJobId: string | null }
    setMessages(data.messages ?? [])
    setVersions(data.versions ?? [])
    setVersionsLoaded(true)
    setActiveJobId(data.activeJobId ?? null)
    setError(null)
    // Shared with the workspace header poll: one /agent/jobs request per tick for the whole page.
    const jobs = await fetchAgentJobShared<NonNullable<typeof liveJob>>(projectId, opts).catch(() => null)
    if (jobs) setLiveJob(jobs.job ?? null)
    return agentJobIsActive(jobs?.job ?? null)
  }, [projectId])
  // Poll (>= 5s, sequential, paused in hidden tabs) only while a job is running; resume when a job changes.
  const [pollEpoch, setPollEpoch] = useState(0)
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ projectId?: string }>).detail?.projectId === projectId) setPollEpoch(n => n + 1)
    }
    window.addEventListener(AGENT_JOB_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(AGENT_JOB_CHANGED_EVENT, onChanged)
  }, [projectId])
  useEffect(() => {
    let active = true
    let loadedOnce = false
    const stop = startPolling(async () => {
      try {
        const running = await reload()
        loadedOnce = true
        return running
      } catch (err) {
        // A 503 means "server busy, try again shortly": back off quietly.
        if (active && !(err instanceof PollHttpError && err.status === 503) && !loadedOnce)
          setError('Version history and chat could not load. Please refresh or try again.')
        throw err
      }
    }, { intervalMs: 5000, immediate: true })
    return () => { active = false; stop() }
  }, [reload, pollEpoch])

  const restore = async (jobId: string) => {
    if (restoring) return
    setRestoring(jobId)
    setError(null)
    try {
      const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId)
        + '/versions/' + encodeURIComponent(jobId) + '/restore', { method: 'POST' })
      if (!response.ok) throw new Error('Could not restore that version.')
      await reload({ fresh: true }).catch(() => false)
      notifyAgentJobChanged(projectId)
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
    const key = pendingSubmission.current?.text === instruction
      ? pendingSubmission.current.key : 'ms_revision_' + crypto.randomUUID()
    pendingSubmission.current = { text: instruction, key }
    try {
      const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId) + '/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json',
          'Idempotency-Key': key },
        body: JSON.stringify({ instruction, answerInput: liveJob?.status === 'needs_input' && answerQuestion,
          selectedElementIds: selectedElementIds ?? [],
          ...(selectedTimeMs != null && Number.isFinite(selectedTimeMs) ? {
            timeRangeMs: [Math.max(0,Math.floor(selectedTimeMs)),Math.floor(selectedTimeMs)+1000] } : {}) }),
      })
      if (!response.ok) throw new Error('We could not send your message yet. Please try again.')
      setDraft('')
      pendingSubmission.current = null
      setAnswerQuestion(true)
      notifyAgentJobChanged(projectId)
      await reload({ fresh: true }).catch(() => false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message.')
    } finally { setBusy(false) }
  }

  return <section className="flex min-h-0 flex-col gap-3 rounded-xl border border-border bg-card p-4"
    aria-label="Transovo AI Assistant conversation" data-testid="ms-agent-chat">
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="size-4" /> Transovo AI Assistant</h3>
    </div>
    <div className="rounded-lg border border-border p-3" data-testid="ms-agent-versions">
      <button type="button" className="flex w-full items-center justify-between text-left text-sm font-semibold"
        onClick={() => setShowVersions(v => !v)} aria-expanded={showVersions}>
        Version history <span className="text-xs font-normal text-muted-foreground">{versionsLoaded ? `${versions.length} saved` : 'Loading…'} {showVersions ? '▴' : '▾'}</span>
      </button>
      {showVersions ? <ol className="mt-3 space-y-2 text-xs">
        {!versions.length ? <li className="text-muted-foreground">No saved versions are available yet.</li> : null}
        {versions.map(v => <li key={v.jobId} className="flex items-center justify-between gap-2">
        <span>Version {v.revision + 1} · {new Date(v.createdAt).toLocaleDateString()}
          {activeJobId === v.jobId ? ' · Current' : ''}</span>
        {activeJobId !== v.jobId ? <button type="button" onClick={() => void restore(v.jobId)}
          disabled={restoring != null} className="text-primary underline">
          {restoring === v.jobId ? 'Restoring…' : 'Restore'}
        </button> : null}
      </li>)}
      </ol> : null}
    </div>
    {liveJob && !['complete','failed','cancelled','dispatch_failed'].includes(liveJob.status) ?
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs" role="status">
        <p className="font-medium">We're working on your video · {Math.round(liveJob.progress)}%</p>
        <p className="mt-1 text-muted-foreground">{liveJob.message || "We're preparing your changes…"}</p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{width:liveJob.progress+'%'}} />
        </div>
        <ol className="mt-2 max-h-28 overflow-y-auto space-y-1 text-muted-foreground">
          {(liveJob.events??[]).slice(-5).map(e=><li key={e.id}>{e.message}</li>)}
        </ol>
      </div> : null}
    <ol className="max-h-[55vh] min-h-36 space-y-3 overflow-y-auto" aria-live="polite">
      {messages.map(m => <li key={m.id} className={m.role === 'customer'
        ? 'ml-6 rounded-xl bg-primary/10 px-3 py-2 text-sm'
        : 'mr-6 rounded-xl bg-muted px-3 py-2 text-sm'}>
        <span className="mb-1 block text-xs font-semibold">{m.role === 'customer' ? 'You' : 'Transovo Assistant'}</span>
        <span className="whitespace-pre-wrap break-words">{m.text}</span>
      </li>)}
      {!messages.length ? <li className="text-sm text-muted-foreground">
        Ask me about your video, request an edit, or check production progress. I can help while it renders.
      </li> : null}
    </ol>
    {liveJob?.status === 'needs_input' ? <label className="flex items-start gap-2 rounded-lg border border-amber-500/30 p-3 text-xs">
      <input type="checkbox" checked={answerQuestion} onChange={e => setAnswerQuestion(e.target.checked)} className="mt-0.5" />
      <span><strong>Production needs your input.</strong> {liveJob.waitingStartedAt ? `Please answer before ${new Date(new Date(liveJob.waitingStartedAt).getTime() + 24 * 60 * 60 * 1000).toLocaleString()}. ` : ''}Check this if your message answers the question; uncheck it to ask the assistant something else.</span>
    </label> : null}
    <label className="sr-only" htmlFor={'ms-agent-instruction-' + projectId}>Message Transovo AI Assistant</label>
    <Textarea id={'ms-agent-instruction-' + projectId} value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {e.preventDefault(); void send()} }}
      placeholder="Ask a question or tell me what to change…" rows={3} maxLength={2500} />
    {error ? <p className="text-xs text-destructive" role="alert">{error}</p> : null}
    <Button size="sm" onClick={() => void send()} disabled={busy || !draft.trim()}>
      {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Send className="mr-2 size-4" />}
      Send
    </Button>
  </section>
}
