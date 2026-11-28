'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Plus } from 'lucide-react'
import { SidebarGroup, SidebarGroupAction, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { agentHref } from '@/lib/agent-lab/team'
import { AgentAvatar } from './agent-avatar'
import { CreateAgentDialog } from './create-agent-dialog'
import { useAgents } from './use-team'

/** Grok Bot-style list of the team's agents in the main menu; each opens that agent's own chat. */
export function AgentsNav({ buttonClass }: { buttonClass: string }) {
  const { data } = useAgents()
  const pathname = usePathname()
  const search = useSearchParams()
  const [creating, setCreating] = useState(false)
  const onChat = (pathname ?? '').replace(/\/+$/, '') === '/app/agent-lab'
  const current = onChat ? search?.get('agent') || data?.default_id || 'agent-lab' : null
  const agents = data?.items ?? []
  return (
    <SidebarGroup data-nav-group="agents">
      <SidebarGroupLabel>Agents</SidebarGroupLabel>
      <SidebarGroupAction title="Create an agent" aria-label="Create an agent" onClick={() => setCreating(true)}>
        <Plus />
      </SidebarGroupAction>
      <SidebarMenu>
        {agents.map((a) => (
          <SidebarMenuItem key={a.id}>
            <SidebarMenuButton
              tooltip={a.name}
              isActive={current === a.id && !search?.get('c')}
              data-nav-id={`agent-${a.id}`}
              className={buttonClass}
              render={<Link href={agentHref(a.id)} title={a.role || a.name} />}
            >
              <AgentAvatar avatar={a.avatar} name={a.name} size="sm" running={a.running} className="-ml-0.5" />
              <span>{a.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
          <SidebarMenuButton className={buttonClass} onClick={() => setCreating(true)} data-nav-id="agent-create">
            <span className="grid size-6 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
              <Plus className="size-3.5" />
            </span>
            <span className="text-muted-foreground">New agent</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <CreateAgentDialog open={creating} onOpenChange={setCreating} />
    </SidebarGroup>
  )
}
