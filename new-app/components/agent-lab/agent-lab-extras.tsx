'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, CheckCircle2, CornerDownLeft, KeyRound, Monitor, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type AgentNotification = {
  id: number
  kind: string
  title: string
  body: string
  conversationId: string | null
  runId: string | null
  files: string[]
  createdAt: string
  read: boolean
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`)
  return data as T
}

const KIND_LABEL: Record<string, string> = { run_done: 'Finished', reminder: 'Reminder', alert: 'Alert', info: 'Note' }

/** Polls the notifications feed; calls onNew for items that arrive while the page is open. */
export function useNotifications(onNew: (n: AgentNotification) => void) {
  const [items, setItems] = useState<AgentNotification[]>([])
  const [unread, setUnread] = useState(0)
  const seen = useRef<Set<number> | null>(null)
  const onNewRef = useRef(onNew)
  onNewRef.current = onNew

  const load = useCallback(async () => {
    try {
      const data = await call<{ items: AgentNotification[]; unread: number }>('/api/agent-lab/notifications')
      setItems(data.items)
      setUnread(data.unread)
      if (seen.current) {
        for (const n of data.items) if (!seen.current.has(n.id) && !n.read) onNewRef.current(n)
      }
      seen.current = new Set(data.items.map((n) => n.id))
    } catch {
      /* optional */
    }
  }, [])

  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 10_000)
    return () => clearInterval(t)
  }, [load])

  const markRead = useCallback(
    async (ids?: number[]) => {
      await call('/api/agent-lab/notifications', { method: 'POST', body: JSON.stringify({ ids: ids ?? [] }) }).catch(() => null)
      void load()
    },
    [load],
  )
  return { items, unread, markRead, reload: load }
}

export function NotificationsPanel({
  items,
  onOpen,
  onMarkAll,
  onClose,
  fileUrl,
}: {
  items: AgentNotification[]
  onOpen: (n: AgentNotification) => void
  onMarkAll: () => void
  onClose: () => void
  fileUrl: (path: string) => string
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Bell className="size-4" /> Notifications
        </span>
        <div className="flex items-center gap-1">
          <Button size="xs" variant="ghost" onClick={onMarkAll}>
            Mark all read
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close notifications">
            <X />
          </Button>
        </div>
      </div>
      <div className="flex max-h-[50vh] flex-col gap-2 overflow-auto">
        {items.length === 0 ? <p className="text-xs text-muted-foreground">Nothing yet. Finished background runs, routines, reminders and alerts show up here.</p> : null}
        {items.map((n) => (
          <div key={n.id} className={cn('rounded-lg border border-border/70 px-3 py-2 text-xs', !n.read && 'bg-muted/60')}>
            <div className="flex items-center gap-2">
              <Badge variant={n.kind === 'alert' ? 'destructive' : 'secondary'}>{KIND_LABEL[n.kind] ?? n.kind}</Badge>
              <span className="min-w-0 flex-1 truncate font-medium">{n.title}</span>
              <span className="shrink-0 text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</span>
            </div>
            {n.body && n.body !== n.title ? <p className="mt-1 line-clamp-4 whitespace-pre-wrap text-muted-foreground">{n.body}</p> : null}
            <div className="mt-1 flex flex-wrap gap-2">
              {n.conversationId ? (
                <button className="underline" onClick={() => onOpen(n)}>
                  Open conversation
                </button>
              ) : null}
              {n.files.slice(0, 6).map((f) => (
                <a key={f} className="underline" href={fileUrl(f)} target="_blank" rel="noreferrer">
                  {f.split('/').pop()}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

type DesktopStatus = { status?: string; message?: string; expires_at?: string | null; x_up?: boolean }

/** Polls the desktop status so sign-in handoffs show up as a notice. */
export function useDesktopStatus() {
  const [status, setStatus] = useState<DesktopStatus | null>(null)
  const load = useCallback(async () => {
    try {
      setStatus(await call<DesktopStatus>('/api/agent-lab/desktop/status'))
    } catch {
      setStatus(null)
    }
  }, [])
  useEffect(() => {
    void load()
    const t = setInterval(() => void load(), 5000)
    return () => clearInterval(t)
  }, [load])
  return { status, reload: load }
}

export function HandoffNotice({ message, onOpenScreen, onDone }: { message: string; onOpenScreen: () => void; onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
      <KeyRound className="size-4 shrink-0 text-amber-600" />
      <span className="min-w-0 flex-1">
        <span className="font-medium">The agent needs you on its screen: </span>
        {message || 'please finish the step on the live screen.'}
      </span>
      <Button size="sm" variant="outline" onClick={onOpenScreen}>
        <Monitor /> Open live screen
      </Button>
      <Button
        size="sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          try {
            await onDone()
          } finally {
            setBusy(false)
          }
        }}
      >
        <CheckCircle2 /> I&apos;m done
      </Button>
    </div>
  )
}

/** Live view of the agent's desktop (1920x1080), refreshed every second, with click / type / key control. */
export function LiveScreen({ onClose }: { onClose: () => void }) {
  const [tick, setTick] = useState(0)
  const [text, setText] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])

  async function post(action: string, body: Record<string, unknown>) {
    try {
      setErr(null)
      await call(`/api/agent-lab/desktop/${action}`, { method: 'POST', body: JSON.stringify(body) })
      setTick((n) => n + 1)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }

  function click(e: React.MouseEvent<HTMLImageElement>, double = false) {
    const img = imgRef.current
    if (!img) return
    const r = img.getBoundingClientRect()
    const x = Math.round(((e.clientX - r.left) / r.width) * 1920)
    const y = Math.round(((e.clientY - r.top) / r.height) * 1080)
    void post('click', { x, y, double })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          <Monitor className="size-4" /> Live screen
        </span>
        <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label="Close live screen">
          <X />
        </Button>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={`/api/agent-lab/desktop/live?t=${tick}`}
        alt="Agent desktop"
        className="w-full cursor-crosshair rounded border border-border bg-black"
        onClick={(e) => click(e)}
        onDoubleClick={(e) => click(e, true)}
      />
      <div className="mt-2 flex items-center gap-2">
        <Input
          type="password"
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type into the focused field (hidden)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void post('type', { text, enter: true })
              setText('')
            }
          }}
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            void post('type', { text, enter: false })
            setText('')
          }}
        >
          Type
        </Button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {[
          ['Enter', 'Return'],
          ['Tab', 'Tab'],
          ['Backspace', 'BackSpace'],
          ['Esc', 'Escape'],
          ['Select all', 'ctrl+a'],
          ['Back', 'alt+Left'],
        ].map(([label, key]) => (
          <Button key={key} size="xs" variant="outline" onClick={() => void post('key', { key })}>
            {label === 'Enter' ? <CornerDownLeft /> : null}
            {label}
          </Button>
        ))}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Click the picture to click on the agent&apos;s screen (double-click works too).</p>
      {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
    </div>
  )
}
