'use client'

import { useEffect } from 'react'
import { usePolled } from '@/components/agent-lab/ops/use-ops-data'
import { gbUrl } from '@/components/agent-lab/ops/gb14'
import type { AgentsDoc } from '@/lib/agent-lab/team'

export const TEAM_CHANGED = 'agentlab:team-changed'

/** The team (agents list), refreshed every 10 s and right after any change on this page (create, rename, remove). */
export function useAgents(intervalMs = 10_000) {
  const res = usePolled<AgentsDoc>(gbUrl('agents'), intervalMs)
  const { reload } = res
  useEffect(() => {
    const on = () => reload()
    window.addEventListener(TEAM_CHANGED, on)
    return () => window.removeEventListener(TEAM_CHANGED, on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return res
}

export function teamChanged() {
  window.dispatchEvent(new Event(TEAM_CHANGED))
}
