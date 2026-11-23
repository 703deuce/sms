'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, Bot, FileText, Flag, KeyRound, Loader2, Monitor, Paperclip, Plus, RefreshCw, Send, SkipForward, Square, Terminal, User, X } from 'lucide-react'
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
}
type Conversation = { id: string; title: string; status: string; createdAt: string | null }
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
      <details className="ml-9 text-xs" open={item.tool === 'helper'}>
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
                  <Button size="xs" variant="outline" title="Stop immediately (send a message to continue later)" onClick={() => void stop()}>
                    <Square /> Stop
                  </Button>
                </>
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
