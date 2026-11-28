'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { agentHref, type TeamAgent } from '@/lib/agent-lab/team'
import { AgentAvatar } from './agent-avatar'
import { CreateAgentDialog } from './create-agent-dialog'
import { useAgents } from './use-team'

/** GB-18 (t367u): the ONE list of agents, messenger style: the primary navigation (desktop middle column, phone home).
 * Every agent, the default one included, is a row like any other. Tapping a row opens that agent's direct chat. */
const SEEN_KEY = 'agentlab:agent-seen'
const SEEN_EVENT = 'agentlab:agent-seen'

function readSeen(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Mark an agent's chat as read up to `at` (Unix seconds). */
export function markAgentSeen(id: string, at: number) {
  if (typeof window === 'undefined' || !id) return
  const seen = readSeen()
  if ((seen[id] ?? 0) >= at) return
  seen[id] = at
  localStorage.setItem(SEEN_KEY, JSON.stringify(seen))
  window.dispatchEvent(new Event(SEEN_EVENT))
}

export function relativeWhen(at?: number | null, now = new Date()): string {
  if (!at) return ''
  const d = new Date(at * 1000)
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((day(now) - day(d)) / 86_400_000)
  if (diff <= 0) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) })
}

export function isUnread(a: TeamAgent, seen: Record<string, number>): boolean {
  const m = a.last_message
  return Boolean(m && m.from !== 'you' && m.at > (seen[a.id] ?? 0))
}

export function AgentList({ currentId, className }: { currentId?: string | null; className?: string }) {
  const { data } = useAgents(10_000)
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [seen, setSeen] = useState<Record<string, number>>({})
  useEffect(() => {
    const on = () => setSeen(readSeen())
    on()
    window.addEventListener(SEEN_EVENT, on)
    window.addEventListener('storage', on)
    return () => {
      window.removeEventListener(SEEN_EVENT, on)
      window.removeEventListener('storage', on)
    }
  }, [])
  const needle = q.trim().toLowerCase()
  const agents = (data?.items ?? [])
    .filter((a) => !needle || `${a.name} ${a.role ?? ''} ${a.last_message?.text ?? ''}`.toLowerCase().includes(needle))
    .sort((a, b) => (b.last_message?.at ?? b.last_activity_at ?? 0) - (a.last_message?.at ?? a.last_activity_at ?? 0))
  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)} data-testid="agent-list">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-lg font-semibold">Agents</h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90"
          aria-label="New agent"
          title="New agent"
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="px-3 pb-2">
        <label className="flex h-9 items-center gap-2 rounded-full bg-muted px-3 text-sm text-muted-foreground">
          <Search className="size-4 shrink-0" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search agents" className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground" />
        </label>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {agents.map((a) => {
          const m = a.last_message
          const unread = isUnread(a, seen) && a.id !== currentId
          const preview = m ? `${m.from === 'you' ? 'You: ' : ''}${m.text}` : a.role || 'No messages yet'
          return (
            <li key={a.id}>
              <Link
                href={agentHref(a.id)}
                data-agent-row={a.id}
                aria-current={a.id === currentId ? 'page' : undefined}
                className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-muted', a.id === currentId && 'bg-muted')}
              >
                <AgentAvatar avatar={a.avatar} name={a.name} color={a.color} size="lg" running={a.running} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className={cn('min-w-0 flex-1 truncate text-sm', unread ? 'font-semibold' : 'font-medium')}>{a.name}</span>
                    <span className={cn('shrink-0 text-xs', unread ? 'font-medium text-primary' : 'text-muted-foreground')}>{relativeWhen(m?.at ?? a.last_activity_at)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={cn('min-w-0 flex-1 truncate text-xs', unread ? 'text-foreground' : 'text-muted-foreground')}>
                      {a.running ? <span className="text-success">Working · </span> : null}
                      {preview}
                    </span>
                    {unread ? <span className="size-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" /> : null}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
        {data && agents.length === 0 ? <li className="px-3 py-6 text-center text-sm text-muted-foreground">No agents match.</li> : null}
      </ul>
      <CreateAgentDialog open={creating} onOpenChange={setCreating} />
    </div>
  )
}
