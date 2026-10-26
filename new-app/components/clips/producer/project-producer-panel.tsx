'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch, patchClip } from '@/lib/clips-api'

type Msg = { role: string; content: string | null }

type AffectedClip = {
  clipId: string
  title: string
  changeCount: number
  before: ClipEditsV2
}

export function ProjectProducerPanel({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [affected, setAffected] = useState<AffectedClip[]>([])
  const [stripUntil, setStripUntil] = useState(0)

  const loadThread = useCallback(async () => {
    const data = await clipsFetch<{ thread: { messages: Msg[] } | null }>(
      `/api/clips/projects/${projectId}/producer`,
    )
    if (data.thread?.messages) setMessages(data.thread.messages)
  }, [projectId])

  useEffect(() => {
    void loadThread().catch(() => {})
  }, [loadThread])

  useEffect(() => {
    if (!stripUntil) return
    const ms = stripUntil - Date.now()
    if (ms <= 0) {
      setAffected([])
      return
    }
    const t = setTimeout(() => setAffected([]), ms)
    return () => clearTimeout(t)
  }, [stripUntil, affected.length])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    try {
      const res = await fetch(`/api/clips/projects/${projectId}/producer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })
      if (!res.ok) throw new Error(await res.text())
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (reader) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const chunks = buf.split('\n\n')
        buf = chunks.pop() || ''
        for (const chunk of chunks) {
          if (chunk.startsWith(':')) continue
          const lines = chunk.split('\n')
          const event = lines.find((l) => l.startsWith('event: '))?.slice(7)
          const dataLine = lines.find((l) => l.startsWith('data: '))?.slice(6)
          if (!event || !dataLine) continue
          const payload = JSON.parse(dataLine)
          if (event === 'error') throw new Error(payload.message || 'Producer failed')
          if (event === 'message') {
            setMessages((m) => [...m, { role: 'assistant', content: payload.content }])
          }
          if (event === 'batch' && payload.clips?.length) {
            const rows: AffectedClip[] = payload.clips.map((c: AffectedClip) => ({
              clipId: c.clipId,
              title: c.title,
              changeCount: c.changeCount,
              before: c.before,
            }))
            setAffected(rows)
            setStripUntil(Date.now() + 15_000)
          }
        }
      }
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Producer failed' },
      ])
    } finally {
      setBusy(false)
    }
  }

  const undoAll = async () => {
    for (const row of affected) {
      await patchClip(row.clipId, { edits: row.before })
    }
    setAffected([])
    setStripUntil(0)
  }

  const chips = ['Bold captions on all clips', 'Apply brand kit', 'Tighten pauses', '9:16 layout']

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      {affected.length > 0 && (
        <div className="rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
          <div className="mb-2 flex items-center justify-between">
            <span>Updated {affected.length} clip{affected.length === 1 ? '' : 's'}</span>
            <Button size="sm" variant="outline" onClick={() => void undoAll()}>Undo all</Button>
          </div>
          <ul className="space-y-1">
            {affected.map((c) => (
              <li key={c.clipId} className="flex justify-between gap-2">
                <Link className="underline" href={`/app/clips/${projectId}/edit/${c.clipId}`}>
                  {c.title}
                </Link>
                <span className="text-muted-foreground">{c.changeCount} change{c.changeCount === 1 ? '' : 's'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <p key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <span className="inline-block rounded-lg bg-muted px-2 py-1">{m.content}</span>
          </p>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <Button key={c} size="sm" variant="secondary" disabled={busy} onClick={() => setInput(c)}>
            {c}
          </Button>
        ))}
      </div>
      <textarea
        className="min-h-[72px] w-full rounded border border-border px-2 py-1 text-sm"
        placeholder="Ask the producer to edit every clip…"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <Button size="sm" disabled={busy} onClick={() => void send()}>{busy ? 'Working…' : 'Send'}</Button>
    </div>
  )
}
