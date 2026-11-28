'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronDown, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { AgentAvatar } from '@/components/agent-lab/team/agent-avatar'
import { useAgents } from '@/components/agent-lab/team/use-team'
import type { TeamAgent } from '@/lib/agent-lab/team'

/**
 * Agent scope for the work pages (Activity, Files, ...): `?agent=<id>` in the URL, or all agents when absent.
 * Kept in the URL with history.replaceState plus a window event so pages need no Suspense boundary.
 */
const SCOPE_EVENT = 'agentlab:agent-scope'

function readScope(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('agent') || null
}

export function setAgentScope(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set('agent', id)
  else url.searchParams.delete('agent')
  window.history.replaceState(window.history.state, '', url.toString())
  window.dispatchEvent(new Event(SCOPE_EVENT))
}

export function useAgentScope(): { agentId: string | null; agents: TeamAgent[]; current: TeamAgent | null; multi: boolean } {
  const [agentId, setId] = useState<string | null>(null)
  const { data } = useAgents(60_000)
  useEffect(() => {
    const on = () => setId(readScope())
    on()
    window.addEventListener(SCOPE_EVENT, on)
    window.addEventListener('popstate', on)
    return () => {
      window.removeEventListener(SCOPE_EVENT, on)
      window.removeEventListener('popstate', on)
    }
  }, [])
  const agents = data?.items ?? []
  const current = agentId ? agents.find((a) => a.id === agentId) ?? null : null
  return { agentId: current ? agentId : null, agents, current, multi: agents.length > 1 }
}

/** True when an item belongs to the scoped agent. Items without an agent_id are team-wide and always shown. */
export function inAgentScope(item: { agent_id?: string | null }, agentId: string | null): boolean {
  return !agentId || !item.agent_id || item.agent_id === agentId
}

/** Header control: which agent's work this page shows. A plain name chip while the team has a single agent. */
export function AgentScopeSwitcher() {
  const { agents, current, multi } = useAgentScope()
  if (agents.length === 0) return null
  if (!multi) {
    const a = agents[0]
    return (
      <span className="inline-flex h-8 items-center gap-2 rounded-full border border-border bg-card pr-3 pl-1 text-xs font-medium" title={a.role || a.name}>
        <AgentAvatar avatar={a.avatar} name={a.name} size="sm" running={a.running} />
        <span className="max-w-[10rem] truncate">{a.name}</span>
      </span>
    )
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-2 rounded-full pl-1" aria-label="Choose which agent's work to show">
            {current ? (
              <AgentAvatar avatar={current.avatar} name={current.name} size="sm" running={current.running} />
            ) : (
              <span className="grid size-6 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Users className="size-3.5" />
              </span>
            )}
            <span className="max-w-[10rem] truncate">{current ? current.name : 'All agents'}</span>
            <ChevronDown className="size-3.5 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show work from</DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setAgentScope(null)}>
          <Users className="size-4" />
          <span className="flex-1">All agents</span>
          {!current && <Check className="size-4" />}
        </DropdownMenuItem>
        {agents.map((a) => (
          <DropdownMenuItem key={a.id} onClick={() => setAgentScope(a.id)}>
            <AgentAvatar avatar={a.avatar} name={a.name} size="sm" running={a.running} />
            <span className="flex-1 truncate">{a.name}</span>
            {current?.id === a.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Small "by <agent>" tag for rows, shown only once the team has more than one agent. */
export function AgentTag({ item, multi }: { item: { agent_id?: string | null; agent_name?: string | null; agent_avatar?: string | null }; multi: boolean }) {
  if (!multi || !item.agent_name) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {item.agent_avatar ? <span aria-hidden>{item.agent_avatar}</span> : null}
      {item.agent_name}
    </span>
  )
}
