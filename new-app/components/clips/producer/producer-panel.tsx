'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToolCallCard } from '@/components/clips/producer/tool-call-card'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

type Msg = { role: string; content: string | null; toolCalls?: unknown }

export function ProducerPanel({
  clipId,
  bounds,
  edits,
  onApplyEdits,
  onUndo,
}: {
  clipId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  onApplyEdits: (edits: ClipEditsV2, changeCount: number) => void
  onUndo: () => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [summaries, setSummaries] = useState<string[]>([])
  const [pendingPaid, setPendingPaid] = useState<{ name: string; args: Record<string, unknown> }[]>([])
  const [appliedCount, setAppliedCount] = useState(0)

  const loadThread = useCallback(async () => {
    const data = await clipsFetch<{ thread: { messages: Msg[] } | null }>(`/api/clips/clips/${clipId}/producer`)
    if (data.thread?.messages) setMessages(data.thread.messages)
  }, [clipId])

  useEffect(() => {
    void loadThread().catch(() => {})
  }, [loadThread])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    setAppliedCount(0)
    setInput('')
    setMessages((m) => [...m, { role: 'user', content: text }])
    try {
      const res = await fetch(`/api/clips/clips/${clipId}/producer`, {
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
          if (event === 'error') {
            throw new Error(payload.message || 'Producer failed')
          }
          if (event === 'message') {
            setMessages((m) => [...m, { role: 'assistant', content: payload.content }])
          }
          if (event === 'confirm' && payload.tool) {
            setPendingPaid((p) => {
              const exists = p.some((t) => t.name === payload.tool.name)
              if (exists) return p
              return [...p, payload.tool]
            })
          }
          if (event === 'tools') {
            setSummaries(payload.summaries || [])
            setPendingPaid(payload.pendingPaid || [])
          }
          if (event === 'edits' && payload.edits) {
            const n = Number(payload.changeCount ?? 0)
            onApplyEdits(payload.edits as ClipEditsV2, n)
            if (n > 0) setAppliedCount(n)
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

  const confirmPaid = async (tool: { name: string; args: Record<string, unknown> }) => {
    await clipsFetch(`/api/clips/clips/${clipId}/producer/confirm`, {
      method: 'POST',
      body: JSON.stringify({ tool }),
    })
    setPendingPaid((p) => p.filter((t) => t.name !== tool.name))
  }

  const chips = ['Make it punchier', 'Add music', 'Tighten pauses', 'Shorter hook']

  return (
    <div className="flex h-full flex-col gap-2 p-3 text-sm">
      {appliedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-2 py-1.5 text-xs">
          <span>{appliedCount} change{appliedCount === 1 ? '' : 's'} applied</span>
          <Button size="sm" variant="outline" onClick={() => { onUndo(); setAppliedCount(0) }}>Undo</Button>
        </div>
      )}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            <p className="inline-block rounded-lg bg-muted px-2 py-1 text-xs">{m.content}</p>
          </div>
        ))}
        {summaries.map((s, i) => <ToolCallCard key={i} summary={s} />)}
        {pendingPaid.map((t) => (
          <div key={t.name} className="rounded border border-amber-500/40 p-2 text-xs">
            <p>Confirm paid tool: {t.name}</p>
            <Button size="sm" className="mt-1" onClick={() => void confirmPaid(t)}>Confirm</Button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {chips.map((c) => (
          <Button key={c} size="sm" variant="outline" onClick={() => setInput(c)}>{c}</Button>
        ))}
      </div>
      <textarea
        className="min-h-[64px] w-full rounded border border-border p-2 text-xs"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder="Tell the producer what to change…"
      />
      <Button size="sm" disabled={busy || !input.trim()} onClick={() => void send()}>Send</Button>
    </div>
  )
}
