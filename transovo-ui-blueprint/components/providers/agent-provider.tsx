'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { DEFAULT_AGENT, diffSections, type AgentConfig } from '@/lib/agent'
import { ago } from '@/lib/numbers'

export type AgentStatus = 'active' | 'paused' | 'draft' | 'publishing' | 'sync_failed'

type AgentCtx = {
  live: AgentConfig
  draft: AgentConfig
  status: AgentStatus
  lastSaved: string
  lastPublished: string
  unsaved: boolean
  changes: { key: keyof AgentConfig; label: string }[]
  update: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K] | ((prev: AgentConfig[K]) => AgentConfig[K])) => void
  saveDraft: () => Promise<void>
  discardDraft: () => void
  publish: (opts?: { fail?: boolean }) => Promise<boolean>
  setPaused: (paused: boolean) => void
}

const Ctx = createContext<AgentCtx | null>(null)

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Demo draft/live state for the AI agent. Publishing never happens implicitly. */
export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<AgentConfig>(DEFAULT_AGENT)
  const [draft, setDraft] = useState<AgentConfig>(DEFAULT_AGENT)
  const [status, setStatus] = useState<AgentStatus>('active')
  const [lastSaved, setLastSaved] = useState(ago(26))
  const [lastPublished, setLastPublished] = useState(ago(26))
  const [unsaved, setUnsaved] = useState(false)

  const update = useCallback<AgentCtx['update']>((key, value) => {
    setDraft((d) => ({ ...d, [key]: typeof value === 'function' ? (value as (p: unknown) => unknown)(d[key]) : value }))
    setUnsaved(true)
  }, [])

  const value = useMemo<AgentCtx>(() => {
    const changes = diffSections(live, draft)
    return {
      live,
      draft,
      status,
      lastSaved,
      lastPublished,
      unsaved,
      changes,
      update,
      saveDraft: async () => {
        await wait(500)
        setUnsaved(false)
        setLastSaved(new Date().toISOString())
      },
      discardDraft: () => {
        setDraft(live)
        setUnsaved(false)
      },
      publish: async (opts) => {
        const prev = status
        setStatus('publishing')
        await wait(1400)
        if (opts?.fail) {
          setStatus('sync_failed')
          return false
        }
        setLive(draft)
        setUnsaved(false)
        const now = new Date().toISOString()
        setLastSaved(now)
        setLastPublished(now)
        setStatus(prev === 'paused' ? 'paused' : 'active')
        return true
      },
      setPaused: (paused) => setStatus(paused ? 'paused' : 'active'),
    }
  }, [live, draft, status, lastSaved, lastPublished, unsaved, update])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAgent() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAgent must be used inside AgentProvider')
  return ctx
}
