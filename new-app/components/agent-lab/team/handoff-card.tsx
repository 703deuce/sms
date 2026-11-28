'use client'

import { ArrowDownLeft, ArrowUpRight, CheckCircle2, CircleAlert, Loader2 } from 'lucide-react'
import { AgentMarkdown } from '@/components/agent-lab/agent-lab-markdown'
import { HANDOFF_OPEN, handoffLabel, type Handoff, type HandoffMessage, type TeamAgent } from '@/lib/agent-lab/team'
import { cn } from '@/lib/utils'
import { AgentAvatar } from './agent-avatar'

/** A hand-off message in a chat: a teammate's request ("From Chief of Staff") or a result coming back ("Result from Marketing"). */
export function HandoffCard({ h, time, agents }: { h: HandoffMessage; time?: string; agents?: TeamAgent[] }) {
  const who = agents?.find((a) => a.name === h.from)
  const result = h.kind === 'result'
  const failed = result && h.state && h.state !== 'done'
  return (
    <div className="flex justify-center" data-role="handoff" data-handoff={h.id}>
      <div
        className={cn(
          'w-full max-w-[min(46rem,92%)] overflow-hidden rounded-card border bg-card shadow-xs',
          result ? (failed ? 'border-warning/40' : 'border-success/40') : 'border-primary/30',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2 border-b px-3 py-2 text-xs',
            result ? (failed ? 'border-warning/30 bg-warning/5' : 'border-success/30 bg-success/5') : 'border-primary/20 bg-primary/5',
          )}
        >
          <AgentAvatar avatar={who?.avatar} name={h.from} size="sm" />
          <span className="font-semibold text-foreground">{result ? `Result from ${h.from}` : `Hand-off from ${h.from}`}</span>
          {result ? (
            failed ? <CircleAlert className="size-3.5 text-warning" /> : <CheckCircle2 className="size-3.5 text-success" />
          ) : (
            <ArrowDownLeft className="size-3.5 text-primary" />
          )}
          <span className="ml-auto text-muted-foreground">{result ? (failed ? 'Not finished' : 'Done') : 'Assigned to this agent'}{time ? ` · ${time}` : ''}</span>
        </div>
        <div className="px-4 py-3 text-sm">
          <AgentMarkdown text={h.body || '(empty)'} />
        </div>
      </div>
    </div>
  )
}

/** Strip above the messages: hand-offs this chat sent (and is waiting on) or is working on for a teammate. */
export function HandoffStrip({ items, conversationId, agents }: { items: Handoff[]; conversationId: string; agents?: TeamAgent[] }) {
  const open = items.filter((h) => HANDOFF_OPEN.has(h.status))
  if (!open.length) return null
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-1.5 text-xs">
      {open.map((h) => {
        const outgoing = h.from_cid === conversationId
        const other = outgoing ? h.to_name : h.from_name
        const avatar = (agents?.find((a) => a.id === (outgoing ? h.to_agent : h.from_agent))?.avatar) ?? (outgoing ? h.to_avatar : h.from_avatar)
        return (
          <span key={h.id} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5" title={h.task}>
            <AgentAvatar avatar={avatar} name={other} size="sm" className="size-4 text-[10px]" />
            {outgoing ? <ArrowUpRight className="size-3 text-primary" /> : <ArrowDownLeft className="size-3 text-primary" />}
            <span className="font-medium">{outgoing ? `${other}` : `For ${other}`}</span>
            <span className="truncate text-muted-foreground">{outgoing ? handoffLabel(h) : 'working on it'}</span>
            <Loader2 className="size-3 animate-spin text-muted-foreground" />
          </span>
        )
      })}
    </div>
  )
}
