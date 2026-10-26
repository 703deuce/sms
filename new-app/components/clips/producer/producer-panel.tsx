'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUp, Coins, Sparkles } from 'lucide-react'
import { PrimaryButton } from '@/components/app/primary-button'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { ToolCallCard } from '@/components/clips/producer/tool-call-card'
import type { ClipBounds, ClipEditsV2 } from '@/lib/clips/edits'
import { clipsFetch } from '@/lib/clips-api'

type Msg = { role: string; content: string | null; toolCalls?: unknown }

export function ProducerPanel({
  clipId,
  bounds,
  edits,
  onApplyEdits,
  onUndo: _onUndo,
}: {
  clipId: string
  bounds: ClipBounds
  edits: ClipEditsV2
  onApplyEdits: (edits: ClipEditsV2, changeCount: number, before: ClipEditsV2) => void
  onUndo: () => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [summaries, setSummaries] = useState<string[]>([])
  const [pendingPaid, setPendingPaid] = useState<{ name: string; args: Record<string, unknown> }[]>([])
  const editsBeforeSend = useRef(edits)
  const bottomRef = useRef<HTMLDivElement>(null)
  editsBeforeSend.current = edits

  const loadThread = useCallback(async () => {
    const data = await clipsFetch<{ thread: { messages: Msg[] } | null }>(`/api/clips/clips/${clipId}/producer`)
    if (data.thread?.messages) setMessages(data.thread.messages)
  }, [clipId])

  useEffect(() => {
    void loadThread().catch(() => {})
  }, [loadThread])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy, summaries])

  const send = async () => {
    const text = input.trim()
    if (!text || busy) return
    setBusy(true)
    editsBeforeSend.current = edits
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
          if (event === 'error') throw new Error(payload.message || 'Producer failed')
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
            onApplyEdits(payload.edits as ClipEditsV2, n, editsBeforeSend.current)
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

  const chips = [
    { label: 'Cut the filler words', icon: 'trim' },
    { label: 'Make captions bold', icon: 'captions' },
    { label: 'Add upbeat music', icon: 'music' },
    { label: 'Punchier title', icon: 'title' },
  ]

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {messages.length === 0 && !busy && (
            <p className="text-center text-xs text-muted-foreground">Ask the producer to edit this clip by chatting.</p>
          )}
          {messages.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                  {m.content}
                </p>
              </div>
            ) : (
              <div key={i} className="flex gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-gradient">
                  <Sparkles className="size-3.5 text-white" aria-hidden />
                </span>
                <p className="max-w-[85%] rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm">{m.content}</p>
              </div>
            ),
          )}
          {busy && (
            <div className="flex gap-2.5" aria-live="polite">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-gradient">
                <Sparkles className="size-3.5 text-white" aria-hidden />
              </span>
              <p className="inline-flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-3.5 py-2 text-sm text-muted-foreground">
                <span className="inline-flex gap-0.5">
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground" />
                </span>
                Thinking…
              </p>
            </div>
          )}
          {summaries.map((s, i) => (
            <ToolCallCard key={i} summary={s} toolName={s.split(' ')[0]?.toLowerCase()} />
          ))}
          {pendingPaid.map((t) => (
            <div key={t.name} className="rounded-xl border border-warning/40 bg-warning/8 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Coins className="size-3.5" aria-hidden />
                Uses credits — {t.name}
              </p>
              <div className="mt-2 flex gap-2">
                <PrimaryButton size="sm" onClick={() => void confirmPaid(t)}>Generate</PrimaryButton>
                <Button size="sm" variant="ghost" onClick={() => setPendingPaid((p) => p.filter((x) => x.name !== t.name))}>
                  Skip
                </Button>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>
      <div className="sticky bottom-0 border-t border-border bg-card p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          {chips.map((c) => (
            <Button
              key={c.label}
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-xs"
              onClick={() => setInput(c.label)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <div className="relative rounded-xl border border-input bg-background focus-within:ring-2 focus-within:ring-ring">
          <Textarea
            className="min-h-[44px] max-h-40 resize-none border-0 bg-transparent pr-12 shadow-none focus-visible:ring-0"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell the producer what to change…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void send()
              }
            }}
          />
          <PrimaryButton
            type="button"
            size="icon"
            className="absolute bottom-2 right-2 size-8 rounded-lg"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            aria-label="Send message"
          >
            <ArrowUp className="size-4" />
          </PrimaryButton>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  )
}
