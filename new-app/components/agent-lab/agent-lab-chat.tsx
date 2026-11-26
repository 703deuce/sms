'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Bell, Bot, ChevronRight, FileText, Flag, KeyRound, Loader2, Monitor, Paperclip, Plus, RefreshCw, Send, SkipForward, Square, Terminal, User, X } from 'lucide-react'
import { AgentMarkdown } from '@/components/agent-lab/agent-lab-markdown'
import {
  HandoffNotice,
  LiveScreen,
  NotificationsPanel,
  VaultPanel,
  useDesktopStatus,
  useNotifications,
  type AgentNotification,
} from '@/components/agent-lab/agent-lab-extras'
import { Page, PageHeader } from '@/components/app/page-primitives'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Item = {
  id: string
  ts: string
  type: 'message' | 'action' | 'observation' | 'error'
  role?: 'user' | 'agent'
  tool?: string
  title?: string
  text: string
  isError?: boolean
  systemNote?: boolean
}
type Conversation = { id: string; title: string; status: string; createdAt: string | null }
type BackgroundJob = { n: number; name: string; status: string; progress: string; elapsed: string; cost: number | null }
type JobsPollResult = { ok: true; active: number } | { ok: false; stale: true } | { ok: false; error: true }

type FileEntry = { path: string; name: string; size: number; modifiedAt: string }

const RUNNING = new Set(['running', 'queued', 'starting'])
const WRAP_UP =
  'Wrap it up and leave it: stop the current sub-work now (no more fixes or retries for it), make sure the best current output is saved, and deliver it with a short list of open issues.'
const SKIP = 'Skip that: drop the part you are working on right now, note it as skipped, and move on with the rest of the task.'
const VIDEO = /\.(mp4|m4v|mov|webm)$/i
const IMAGE = /\.(png|jpe?g|webp|gif)$/i
const AUDIO = /\.(mp3|wav|m4a)$/i

function fileUrl(path: string, download = false) {
  return `/api/agent-lab/file?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}`
}

async function postForm<T>(url: string, form: FormData): Promise<T> {
  const res = await fetch(url, { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

function fmtSize(n: number) {
  if (n > 1e9) return `${(n / 1e9).toFixed(1)} GB`
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`
  return `${Math.max(1, Math.round(n / 1e3))} KB`
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

async function fetchJobs(id: string, signal?: AbortSignal): Promise<{ jobs: BackgroundJob[]; active: number }> {
  const res = await fetch(`/api/agent-lab/conversations/${encodeURIComponent(id)}/jobs`, { cache: 'no-store', signal })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as { jobs: BackgroundJob[]; active: number }
}

function SystemNote({ text }: { text: string }) {
  return (
    <p className="mx-auto max-w-[92%] whitespace-pre-wrap text-center text-[11px] leading-snug text-muted-foreground">{text}</p>
  )
}

function JobsStrip({ jobs }: { jobs: BackgroundJob[] }) {
  if (!jobs.length) return null
  return (
    <div className="flex flex-col gap-1 border-b border-border bg-muted/30 px-4 py-2 text-xs">
      {jobs.map((j) => (
        <div key={j.n} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-medium text-foreground">{j.name}</span>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            {j.status}
          </Badge>
          <span className="text-muted-foreground">{j.elapsed}</span>
          {j.progress ? <span className="min-w-0 flex-1 truncate text-muted-foreground">{j.progress}</span> : null}
        </div>
      ))}
    </div>
  )
}

function fmtTime(ts: string) {
  const d = new Date(ts)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function ChatMessage({ item }: { item: Item }) {
  const mine = item.role === 'user'
  const time = fmtTime(item.ts)
  return (
    <div className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')} data-role={mine ? 'user' : 'agent'}>
      {mine ? null : (
        <div className="mb-5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Bot className="size-4" />
        </div>
      )}
      <div className={cn('flex min-w-0 max-w-[80%] flex-col', mine ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'min-w-0 max-w-full break-words px-4 py-2.5 text-sm shadow-sm',
            mine
              ? 'agent-bubble-user whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary text-primary-foreground'
              : 'agent-bubble-agent rounded-2xl rounded-bl-md border border-border bg-background text-foreground',
          )}
        >
          {mine ? item.text : <AgentMarkdown text={item.text} />}
        </div>
        {time ? <span className="mt-1 px-1 text-[10px] text-muted-foreground">{mine ? 'You' : 'Agent'} · {time}</span> : null}
      </div>
      {mine ? (
        <div className="mb-5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="size-4" />
        </div>
      ) : null}
    </div>
  )
}

function ToolRow({ title, text, isError, defaultOpen }: { title: string; text?: string; isError?: boolean; defaultOpen?: boolean }) {
  const body = text?.trim()
  if (!body) {
    return (
      <div className={cn('flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground', isError && 'text-destructive')}>
        <Terminal className="size-3 shrink-0" />
        <span className="truncate">{title}</span>
      </div>
    )
  }
  return (
    <details className="group text-xs" open={defaultOpen}>
      <summary
        className={cn(
          'flex cursor-pointer list-none items-center gap-1.5 py-0.5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden',
          isError && 'text-destructive',
        )}
      >
        <ChevronRight className="size-3 shrink-0 transition-transform group-open:rotate-90" />
        <Terminal className="size-3 shrink-0" />
        <span className="min-w-0 truncate">{title}</span>
      </summary>
      <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 font-mono text-[11px]">{body}</pre>
    </details>
  )
}

function ActivityGroup({ steps, errors, last, live, children }: { steps: number; errors: number; last: string; live: boolean; children: ReactNode }) {
  return (
    <details className="group/act ml-9 max-w-[80%] rounded-xl border border-dashed border-border bg-muted/30 px-3 py-1.5 text-xs" open={live}>
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3 shrink-0 transition-transform group-open/act:rotate-90" />
        <Terminal className="size-3 shrink-0" />
        <span className="shrink-0 font-medium">
          {live ? 'Working' : 'Worked'} · {steps} step{steps === 1 ? '' : 's'}
        </span>
        {errors ? <span className="shrink-0 text-destructive">· {errors} error{errors === 1 ? '' : 's'}</span> : null}
        {last ? <span className="min-w-0 truncate opacity-80">· {last}</span> : null}
      </summary>
      <div className="mt-1.5 flex flex-col gap-0.5 border-l border-border pl-2">{children}</div>
    </details>
  )
}

function ChatThread({ items, live = false }: { items: Item[]; live?: boolean }) {
  const out: ReactNode[] = []
  let group: { key: string; rows: ReactNode[]; errors: number; last: string } | null = null
  const flush = (isLast: boolean) => {
    if (!group) return
    out.push(
      <ActivityGroup key={`act-${group.key}`} steps={group.rows.length} errors={group.errors} last={group.last} live={live && isLast}>
        {group.rows}
      </ActivityGroup>,
    )
    group = null
  }
  const nodes = {
    push(node: ReactNode, meta?: { tool: boolean; title?: string; error?: boolean; key: string }) {
      if (meta?.tool) {
        if (!group) group = { key: meta.key, rows: [], errors: 0, last: '' }
        group.rows.push(node)
        if (meta.error) group.errors += 1
        if (meta.title) group.last = meta.title
        return
      }
      flush(false)
      out.push(node)
    },
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (item.type === 'message') {
      if (item.systemNote) {
        nodes.push(<SystemNote key={item.id} text={item.text} />)
        continue
      }
      nodes.push(<ChatMessage key={item.id} item={item} />)
      continue
    }
    if (item.type === 'action') {
      const next = items[i + 1]
      const paired = next && next.type === 'observation' && (!next.tool || !item.tool || next.tool === item.tool)
      if (paired && next) {
        const title = item.title || next.title || item.tool || 'Tool'
        const text = [item.text, next.text].filter((s) => s && s.trim()).join('\n\n')
        nodes.push(
          <ToolRow key={item.id} title={title} text={text} isError={next.isError} defaultOpen={item.tool === 'helper' || next.tool === 'helper'} />,
          { tool: true, title, error: next.isError, key: item.id },
        )
        i += 1
        continue
      }
      nodes.push(<ToolRow key={item.id} title={item.title || item.tool || 'Tool'} text={item.text} isError={item.isError} />, {
        tool: true,
        title: item.title || item.tool || 'Tool',
        error: item.isError,
        key: item.id,
      })
      continue
    }
    if (item.type === 'observation') {
      if (!item.text.trim() && !item.title) continue
      nodes.push(
        <ToolRow
          key={item.id}
          title={item.title ?? (item.isError ? 'Output (error)' : 'Output')}
          text={item.text}
          isError={item.isError}
          defaultOpen={item.tool === 'helper'}
        />,
        { tool: true, title: item.title ?? 'Output', error: item.isError, key: item.id },
      )
      continue
    }
    nodes.push(<ToolRow key={item.id} title={item.title || 'Error'} text={item.text} isError />, {
      tool: true,
      title: item.title || 'Error',
      error: true,
      key: item.id,
    })
  }
  flush(true)
  return <>{out}</>
}

type TaskCriterion = { id: string; text: string; status: string }
type TaskMilestone = { id: string; text: string; status: string; criteria: string[] }
type TaskRecord = { goal: string; phase: string; milestones: TaskMilestone[]; criteria: TaskCriterion[] }

function verdictMark(status: string) {
  return status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '?'
}

function TaskChecklist({ task }: { task: TaskRecord }) {
  const byId = new Map(task.criteria.map((c) => [c.id, c]))
  const linked = new Set(task.milestones.flatMap((m) => m.criteria))
  const loose = task.criteria.filter((c) => !linked.has(c.id))
  return (
    <div className="flex flex-col gap-1 rounded-md border p-2 text-xs">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Checklist</span>
        {task.phase ? <span className="text-muted-foreground">{task.phase}</span> : null}
      </div>
      {task.goal ? <p className="text-muted-foreground">{task.goal}</p> : null}
      {task.milestones.map((m) => (
        <div key={m.id}>
          <div className={m.status === 'done' ? 'text-muted-foreground line-through' : ''}>
            {m.status === 'done' ? '☑' : '☐'} {m.text}
          </div>
          {m.criteria.map((cid) => {
            const c = byId.get(cid)
            return c ? (
              <div key={cid} className="pl-4" title={c.status}>
                {verdictMark(c.status)} {c.text}
              </div>
            ) : null
          })}
        </div>
      ))}
      {loose.map((c) => (
        <div key={c.id} title={c.status}>
          {verdictMark(c.status)} {c.text}
        </div>
      ))}
    </div>
  )
}

export function AgentLabChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState<string>('idle')
  const [cost, setCost] = useState<number | null>(null)
  const [jobs, setJobs] = useState<BackgroundJob[]>([])
  const [jobsActiveCount, setJobsActiveCount] = useState(0)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [task, setTask] = useState<TaskRecord | null>(null)
  const [preview, setPreview] = useState<FileEntry | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInput = useRef<HTMLInputElement>(null)
  const [showNotes, setShowNotes] = useState(false)
  const [showScreen, setShowScreen] = useState(false)
  const [showVault, setShowVault] = useState(false)
  const [banner, setBanner] = useState<AgentNotification | null>(null)
  const notes = useNotifications((n) => setBanner(n))
  const desk = useDesktopStatus()
  const handoffWaiting = desk.status?.status === 'waiting'
  const lastTs = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const jobsPollGenRef = useRef(0)
  const jobsAbortRef = useRef<AbortController | null>(null)

  const loadConversations = useCallback(async () => {
    try {
      const data = await api<{ conversations: Conversation[] }>('/api/agent-lab/conversations')
      setConversations(data.conversations)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // The checklist is the agent's task record (log/task.json): milestones, each with its success criteria.
  const loadTask = useCallback(async () => {
    if (!activeId) return setTask(null)
    try {
      const d = await api<{ task: TaskRecord | null }>(`/api/agent-lab/conversations/${encodeURIComponent(activeId)}/tasks`)
      setTask(d.task && (d.task.milestones.length || d.task.criteria.length) ? d.task : null)
    } catch {
      /* the checklist is optional */
    }
  }, [activeId])

  // The files panel shows the current conversation's job folder only.
  const loadFiles = useCallback(async () => {
    if (!activeId) {
      setFiles([])
      setTask(null)
      return
    }
    void loadTask()
    try {
      const data = await api<{ files: FileEntry[] }>(`/api/agent-lab/files?conversation=${encodeURIComponent(activeId)}`)
      setFiles(data.files)
    } catch {
      /* the list is optional */
    }
  }, [activeId, loadTask])

  useEffect(() => {
    setPreview(null)
  }, [activeId])

  const poll = useCallback(async (id: string, reset = false) => {
    const since = reset ? null : lastTs.current
    const data = await api<{ items: Item[]; status: string; cost: number | null; lastTs: string | null }>(
      `/api/agent-lab/conversations/${id}${since ? `?since=${encodeURIComponent(since)}` : ''}`,
    )
    lastTs.current = data.lastTs
    setStatus(data.status)
    setCost(data.cost)
    setItems((prev) => {
      const base = reset ? [] : prev
      const seen = new Set(base.map((i) => i.id))
      const fresh = data.items.filter((i) => !seen.has(i.id))
      return fresh.length || reset ? [...base, ...fresh] : prev
    })
    return data.status
  }, [])

  useEffect(() => {
    void loadConversations()
    void loadFiles()
  }, [loadConversations, loadFiles])

  const pollJobs = useCallback(async (id: string, signal?: AbortSignal): Promise<JobsPollResult> => {
    const gen = jobsPollGenRef.current
    try {
      const data = await fetchJobs(id, signal)
      if (gen !== jobsPollGenRef.current) return { ok: false, stale: true }
      setJobs(data.jobs)
      setJobsActiveCount(data.active)
      return { ok: true, active: data.active }
    } catch (e) {
      const aborted = signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')
      if (aborted || gen !== jobsPollGenRef.current) return { ok: false, stale: true }
      setJobs([])
      setJobsActiveCount(0)
      return { ok: false, error: true }
    }
  }, [])

  const running = RUNNING.has(status)

  useEffect(() => {
    jobsPollGenRef.current += 1
    jobsAbortRef.current?.abort()
    const ac = new AbortController()
    jobsAbortRef.current = ac
    setJobs([])
    setJobsActiveCount(0)
    return () => ac.abort()
  }, [activeId])

  // Poll /jobs every 2s while the chat or runner-reported active jobs; backoff on errors (max 30s).
  useEffect(() => {
    if (!activeId) return
    const signal = jobsAbortRef.current?.signal
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let backoffMs = 2000

    const tick = async () => {
      const result = await pollJobs(activeId, signal)
      if (stopped) return
      if (!result.ok) {
        if (result.stale) return
        backoffMs = Math.min(backoffMs * 2, 30000)
        timer = setTimeout(() => void tick(), backoffMs)
        return
      }
      backoffMs = 2000
      if (running || result.active > 0) timer = setTimeout(() => void tick(), 2000)
    }

    void tick()
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [activeId, running, pollJobs])

  // Load a conversation, then keep polling while the agent is working.
  useEffect(() => {
    if (!activeId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasRunning = false
    let ticks = 0
    const tick = async (reset: boolean) => {
      try {
        const s = await poll(activeId, reset)
        const running = RUNNING.has(s)
        if (wasRunning && !running) {
          void loadFiles()
          void loadConversations()
        }
        if (running && ++ticks % 4 === 0) void loadTask()
        wasRunning = running
        if (!stopped) timer = setTimeout(() => void tick(false), running ? 1500 : 5000)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        if (!stopped) timer = setTimeout(() => void tick(false), 5000)
      }
    }
    lastTs.current = null
    setItems([])
    void tick(true)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
    }
  }, [activeId, poll, loadFiles, loadTask, loadConversations])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length])

  /** Quick steering while the agent works: sent as a normal message, read before its next step. */
  async function steer(text: string) {
    if (!activeId || sending) return
    setSending(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('message', text)
      await postForm(`/api/agent-lab/conversations/${activeId}/messages`, form)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function send() {
    const message = draft.trim()
    if ((!message && !attachments.length) || sending) return
    setSending(true)
    setError(null)
    try {
      const form = new FormData()
      form.append('message', message)
      for (const f of attachments) form.append('files', f, f.name)
      if (!activeId) {
        const { id } = await postForm<{ id: string }>('/api/agent-lab/conversations', form)
        setActiveId(id)
        void loadConversations()
      } else {
        await postForm(`/api/agent-lab/conversations/${activeId}/messages`, form)
        setStatus('running')
      }
      setDraft('')
      setAttachments([])
      if (fileInput.current) fileInput.current.value = ''
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function stop() {
    if (!activeId) return
    const id = activeId
    const [stopRes, cancelRes] = await Promise.allSettled([
      api(`/api/agent-lab/conversations/${id}/stop`, { method: 'POST' }),
      api(`/api/agent-lab/conversations/${id}/jobs/cancel`, { method: 'POST' }),
    ])
    await pollJobs(id, jobsAbortRef.current?.signal)
    const cancelFailed = cancelRes.status === 'rejected'
    const bothFailed = stopRes.status === 'rejected' && cancelRes.status === 'rejected'
    if (bothFailed || cancelFailed) {
      const err =
        cancelRes.status === 'rejected'
          ? cancelRes.reason
          : stopRes.status === 'rejected'
            ? stopRes.reason
            : null
      setError(err instanceof Error ? err.message : String(err ?? 'Stop failed'))
    }
  }

  const backgroundActive = jobsActiveCount > 0
  const stoppable = Boolean(activeId && (running || backgroundActive))

  return (
    <Page>
      <PageHeader title="Transovo Agent Lab" description="Talk to Transovo's own video agent. It finds footage, edits with ffmpeg, looks at its work and fixes it." />
      {error ? (
        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}{' '}
          <button className="underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant={showNotes ? 'default' : 'outline'}
          onClick={() => {
            setShowNotes((v) => !v)
            setBanner(null)
          }}
        >
          <Bell /> Notifications
          {notes.unread ? <Badge variant="destructive">{notes.unread}</Badge> : null}
        </Button>
        <Button size="sm" variant={showScreen ? 'default' : 'outline'} onClick={() => setShowScreen((v) => !v)}>
          <Monitor /> Live screen
        </Button>
        <Button size="sm" variant={showVault ? 'default' : 'outline'} onClick={() => setShowVault((v) => !v)}>
          <KeyRound /> Vault
        </Button>
        <a className="text-sm text-muted-foreground underline" href="/app/agent-lab/pages" target="_blank" rel="noreferrer">
          Pages
        </a>
      </div>
      {handoffWaiting ? (
        <HandoffNotice
          message={desk.status?.message ?? ''}
          onOpenScreen={() => setShowScreen(true)}
          onDone={async () => {
            await api('/api/agent-lab/desktop/done', { method: 'POST', body: '{}' }).catch((e) => setError(String(e)))
            await desk.reload()
          }}
        />
      ) : null}
      {banner && !showNotes ? (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm">
          <Bell className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{banner.title}</span>
          {banner.conversationId ? (
            <button
              className="underline"
              onClick={() => {
                setActiveId(banner.conversationId)
                void notes.markRead([banner.id])
                setBanner(null)
              }}
            >
              Open
            </button>
          ) : null}
          <button className="underline" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      ) : null}
      {showNotes ? (
        <NotificationsPanel
          items={notes.items}
          fileUrl={(p) => fileUrl(p)}
          onOpen={(n) => {
            if (n.conversationId) setActiveId(n.conversationId)
            void notes.markRead([n.id])
          }}
          onMarkAll={() => void notes.markRead()}
          onClose={() => setShowNotes(false)}
          onVault={() => setShowVault(true)}
        />
      ) : null}
      {showVault ? <VaultPanel onClose={() => setShowVault(false)} /> : null}
      {showScreen ? <LiveScreen onClose={() => setShowScreen(false)} /> : null}
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-2">
          {task ? <TaskChecklist task={task} /> : null}
          <Button
            variant="outline"
            onClick={() => {
              setActiveId(null)
              setItems([])
              setStatus('idle')
              setCost(null)
              setJobs([])
              setJobsActiveCount(0)
            }}
          >
            <Plus /> New conversation
          </Button>
          <div className="flex max-h-[70vh] flex-col gap-1 overflow-auto">
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={cn(
                  'rounded-lg px-3 py-2 text-left text-sm hover:bg-muted',
                  c.id === activeId && 'bg-muted font-medium',
                )}
              >
                <div className="truncate">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''} · {c.status}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[70vh] flex-col rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">
              {activeId ? conversations.find((c) => c.id === activeId)?.title ?? 'Conversation' : 'New conversation'}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {cost != null ? <span className="text-xs text-muted-foreground">${cost.toFixed(3)}</span> : null}
              {activeId ? (
                <Badge variant={running || backgroundActive ? 'default' : 'secondary'}>{running || backgroundActive ? 'Working' : status}</Badge>
              ) : null}
              {running ? (
                <>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={sending}
                    title="Finish now: stop the current sub-task, deliver the best current result and list open issues"
                    onClick={() => void steer(WRAP_UP)}
                  >
                    <Flag /> Wrap up
                  </Button>
                  <Button
                    size="xs"
                    variant="outline"
                    disabled={sending}
                    title="Drop the part it is working on and continue with the rest"
                    onClick={() => void steer(SKIP)}
                  >
                    <SkipForward /> Skip this
                  </Button>
                </>
              ) : null}
              {stoppable ? (
                <Button size="xs" variant="outline" title="Stop the agent and cancel background jobs" onClick={() => void stop()}>
                  <Square /> Stop
                </Button>
              ) : null}
            </div>
          </div>
          <JobsStrip jobs={jobs} />
          <div className="flex flex-1 flex-col gap-4 overflow-auto px-4 py-5 sm:px-6" style={{ maxHeight: '62vh' }}>
            {items.length === 0 ? (
              <p className="m-auto max-w-md text-center text-sm text-muted-foreground">
                {activeId ? 'Loading…' : 'Ask for anything: “Find a 20 second clip of a lighthouse at sunset and make it vertical with a slow push-in.”'}
              </p>
            ) : (
              <ChatThread items={items} live={running} />
            )}
            {running ? (
              <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Working…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          {attachments.length ? (
            <div className="flex flex-wrap gap-1.5 border-t border-border px-3 pt-2">
              {attachments.map((f, i) => (
                <span key={`${f.name}-${i}`} className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                  <Paperclip className="size-3" />
                  <span className="max-w-48 truncate">{f.name}</span>
                  <span className="text-muted-foreground">{fmtSize(f.size)}</span>
                  <button aria-label={`Remove ${f.name}`} onClick={() => setAttachments((a) => a.filter((_, j) => j !== i))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex items-end gap-2 border-t border-border p-3">
            <input
              ref={fileInput}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const picked = Array.from(e.target.files ?? [])
                if (picked.length) setAttachments((a) => [...a, ...picked].slice(0, 20))
                e.target.value = ''
              }}
            />
            <Button size="icon" variant="ghost" onClick={() => fileInput.current?.click()} aria-label="Attach files" title="Attach files or images">
              <Paperclip />
            </Button>
            <Textarea
              onPaste={(e) => {
                const pasted = Array.from(e.clipboardData.files ?? [])
                if (pasted.length) setAttachments((a) => [...a, ...pasted].slice(0, 20))
              }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={running ? "Steer it while it works (e.g. “skip the intro”, “wrap it up”). It reads your message before its next step." : "Message the agent…"}
              className="max-h-48"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <Button onClick={() => void send()} disabled={sending || (!draft.trim() && !attachments.length)}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />} Send
            </Button>
          </div>
        </section>

        <aside className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Files</span>
            <Button size="icon-sm" variant="ghost" onClick={() => void loadFiles()} aria-label="Refresh files">
              <RefreshCw />
            </Button>
          </div>
          {preview ? (
            <div className="rounded-lg border border-border p-2">
              {VIDEO.test(preview.name) ? (
                <video key={preview.path} src={fileUrl(preview.path)} controls playsInline className="max-h-80 w-full rounded bg-black" />
              ) : IMAGE.test(preview.name) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={fileUrl(preview.path)} alt={preview.name} className="w-full rounded" />
              ) : AUDIO.test(preview.name) ? (
                <audio key={preview.path} src={fileUrl(preview.path)} controls className="w-full" />
              ) : (
                <iframe src={fileUrl(preview.path)} title={preview.name} className="h-64 w-full rounded bg-background" />
              )}
              <div className="mt-1 flex items-center justify-between gap-2 text-xs">
                <span className="truncate">{preview.name}</span>
                <a className="underline" href={fileUrl(preview.path, true)}>
                  Download
                </a>
              </div>
            </div>
          ) : null}
          <div className="flex max-h-[60vh] flex-col gap-1 overflow-auto">
            {files.length === 0 ? <p className="text-xs text-muted-foreground">No files yet.</p> : null}
            {files.map((f) => (
              <button
                key={f.path}
                onClick={() => setPreview(f)}
                title={f.path}
                className={cn('flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted', preview?.path === f.path && 'bg-muted')}
              >
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{f.path.replace(/^\/workspace\/(jobs\/[^/]+|project)\//, '')}</span>
                <span className="shrink-0 text-muted-foreground">{fmtSize(f.size)}</span>
              </button>
            ))}
          </div>
        </aside>
      </div>
    </Page>
  )
}
