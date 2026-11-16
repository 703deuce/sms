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
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const reload = useCallback(async () => {
    const response = await fetch('/api/motion-studio/agent/projects/' + encodeURIComponent(projectId) + '/chat', {
      cache: 'no-store',
    })
    if (!response.ok) throw new Error('Could not load your conversation.')
    const data = await response.json() as { messages: Message[]; versions: Version[] }
    setMessages(data.messages ?? [])
    setVersions(data.versions ?? [])
  }, [projectId])
  useEffect(() => {
    let active = true
    const load = () => { if (active) void reload().catch(() => {/* brief network failures are retried */}) }
    load()
    const timer = window.setInterval(load, 4000)
    return () => { active = false; window.clearInterval(timer) }
  }, [reload])

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
      {versions.map(v => <li key={v.jobId}>Version {v.revision + 1} · {new Date(v.createdAt).toLocaleDateString()}</li>)}
    </ol> : null}
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
