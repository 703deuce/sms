'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { ArrowUp, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { T2vDraftV1 } from '@/lib/t2v/types'

type Msg = { role: 'user' | 'assistant'; content: string }

export function T2vProducerPanel({
  draftId,
  onDocument,
  onAssembling,
}: {
  draftId: string
  onDocument: (doc: T2vDraftV1, revision: number) => void
  onAssembling?: () => void
}) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [pendingConfirm, setPendingConfirm] = useState<{ message: string; reply: string } | null>(null)

  const send = async (confirmDestructive = false) => {
    const text = confirmDestructive ? pendingConfirm?.message ?? '' : input.trim()
    if (!text || busy) return
    setBusy(true)
    if (!confirmDestructive) {
      setInput('')
      setMessages((m) => [...m, { role: 'user', content: text }])
    }
    try {
      const res = await fetch(`/api/t2v/drafts/${draftId}/producer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, confirmDestructive }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'producer_failed')
      if (body.data?.needsConfirm) {
        setPendingConfirm({ message: text, reply: body.data.reply ?? '' })
        setMessages((m) => [...m, { role: 'assistant', content: body.data.message ?? 'Confirm destructive changes?' }])
        return
      }
      setPendingConfirm(null)
      const reply = body.data?.reply ?? 'Done.'
      setMessages((m) => [...m, { role: 'assistant', content: reply }])
      if (body.data?.summaries?.length) {
        toast.message(body.data.summaries.join(' · '))
      }
      if (body.data?.document) {
        onDocument(body.data.document as T2vDraftV1, body.data.revision as number)
      }
      if (body.data?.requestRebuild) {
        toast.success('Rebuilding video…')
        onAssembling?.()
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Chat failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-[320px] flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        Try: make scene 3 punchier, use a British female voice, rebuild the video
      </p>
      <div className="flex-1 space-y-2 overflow-y-auto rounded-lg border border-border p-2 text-sm">
        {messages.length === 0 ? (
          <p className="text-muted-foreground">Ask for script or storyboard changes.</p>
        ) : (
          messages.map((m, i) => (
            <p key={i} className={m.role === 'user' ? 'text-foreground' : 'text-muted-foreground'}>
              <span className="font-medium">{m.role === 'user' ? 'You' : 'Assistant'}:</span> {m.content}
            </p>
          ))
        )}
      </div>
      {pendingConfirm ? (
        <div className="flex flex-wrap gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
          <p className="flex-1">Confirm scene removal / shorten?</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setPendingConfirm(null)}>Cancel</Button>
          <Button type="button" size="sm" onClick={() => void send(true)}>Confirm</Button>
        </div>
      ) : null}
      <div className="flex gap-2">
        <Textarea
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Magic Box…"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <Button type="button" size="icon" disabled={busy || !input.trim()} onClick={() => void send()} aria-label="Send">
          {busy ? <Sparkles className="size-4 animate-pulse" /> : <ArrowUp className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
