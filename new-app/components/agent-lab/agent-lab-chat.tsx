'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bot, FileText, Loader2, Plus, RefreshCw, Send, Square, Terminal, User } from 'lucide-react'
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
}
type Conversation = { id: string; title: string; status: string; createdAt: string | null }
type FileEntry = { path: string; name: string; size: number; modifiedAt: string }

const RUNNING = new Set(['running', 'queued', 'starting'])
const VIDEO = /\.(mp4|m4v|mov|webm)$/i
const IMAGE = /\.(png|jpe?g|webp|gif)$/i
const AUDIO = /\.(mp3|wav|m4a)$/i

function fileUrl(path: string, download = false) {
  return `/api/agent-lab/file?path=${encodeURIComponent(path)}${download ? '&download=1' : ''}`
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

function ChatItem({ item }: { item: Item }) {
  if (item.type === 'message') {
    const mine = item.role === 'user'
    return (
      <div className={cn('flex gap-2', mine && 'flex-row-reverse')}>
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          {mine ? <User className="size-4" /> : <Bot className="size-4" />}
        </div>
        <div
          className={cn(
            'max-w-[85%] whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm',
            mine ? 'bg-primary text-primary-foreground' : 'bg-muted',
          )}
        >
          {item.text}
        </div>
      </div>
    )
  }
  if (item.type === 'action') {
    return (
      <div className="ml-9 rounded-lg border border-border/70 bg-background/60 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
          <Terminal className="size-3.5" />
          {item.title}
        </div>
        {item.text ? <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{item.text}</pre> : null}
      </div>
    )
  }
  if (item.type === 'observation') {
    if (!item.text.trim()) return null
    return (
      <details className="ml-9 text-xs">
        <summary className={cn('cursor-pointer select-none text-muted-foreground', item.isError && 'text-destructive')}>
          {item.title ?? (item.isError ? 'Output (error)' : 'Output')}
        </summary>
        <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/60 p-2 font-mono text-[11px]">{item.text}</pre>
      </details>
    )
  }
  return (
    <div className="ml-9 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">
      {item.title ? <div className="mb-0.5 font-medium">{item.title}</div> : null}
      {item.text}
    </div>
  )
}

export function AgentLabChat() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [status, setStatus] = useState<string>('idle')
  const [cost, setCost] = useState<number | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])
  const [preview, setPreview] = useState<FileEntry | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lastTs = useRef<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const data = await api<{ conversations: Conversation[] }>('/api/agent-lab/conversations')
      setConversations(data.conversations)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // The files panel shows the current conversation's job folder only.
  const loadFiles = useCallback(async () => {
    if (!activeId) {
      setFiles([])
      return
    }
    try {
      const data = await api<{ files: FileEntry[] }>(`/api/agent-lab/files?conversation=${encodeURIComponent(activeId)}`)
      setFiles(data.files)
    } catch {
      /* the list is optional */
    }
  }, [activeId])

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

  // Load a conversation, then keep polling while the agent is working.
  useEffect(() => {
    if (!activeId) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let wasRunning = false
    const tick = async (reset: boolean) => {
      try {
        const s = await poll(activeId, reset)
        const running = RUNNING.has(s)
        if (wasRunning && !running) {
          void loadFiles()
          void loadConversations()
        }
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
  }, [activeId, poll, loadFiles, loadConversations])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [items.length])

  async function send() {
    const message = draft.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    try {
      if (!activeId) {
        const { id } = await api<{ id: string }>('/api/agent-lab/conversations', { method: 'POST', body: JSON.stringify({ message }) })
        setActiveId(id)
        void loadConversations()
      } else {
        await api(`/api/agent-lab/conversations/${activeId}/messages`, { method: 'POST', body: JSON.stringify({ message }) })
        setStatus('running')
      }
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSending(false)
    }
  }

  async function stop() {
    if (!activeId) return
    try {
      await api(`/api/agent-lab/conversations/${activeId}/stop`, { method: 'POST' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const running = RUNNING.has(status)

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
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_320px]">
        <aside className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setActiveId(null)
              setItems([])
              setStatus('idle')
              setCost(null)
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
            <span className="truncate font-medium">{activeId ? conversations.find((c) => c.id === activeId)?.title ?? 'Conversation' : 'New conversation'}</span>
            <div className="flex items-center gap-2">
              {cost != null ? <span className="text-xs text-muted-foreground">${cost.toFixed(3)}</span> : null}
              {activeId ? <Badge variant={running ? 'default' : 'secondary'}>{running ? 'Working' : status}</Badge> : null}
              {running ? (
                <Button size="xs" variant="outline" onClick={() => void stop()}>
                  <Square /> Stop
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-auto p-4" style={{ maxHeight: '62vh' }}>
            {items.length === 0 ? (
              <p className="m-auto max-w-md text-center text-sm text-muted-foreground">
                {activeId ? 'Loading…' : 'Ask for anything: “Find a 20 second clip of a lighthouse at sunset and make it vertical with a slow push-in.”'}
              </p>
            ) : (
              items.map((item) => <ChatItem key={item.id} item={item} />)
            )}
            {running ? (
              <div className="ml-9 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> Working…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>
          <div className="flex items-end gap-2 border-t border-border p-3">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Message the agent…"
              className="max-h-48"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void send()
                }
              }}
            />
            <Button onClick={() => void send()} disabled={sending || !draft.trim()}>
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
