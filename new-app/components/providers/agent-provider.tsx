'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DEFAULT_AGENT, diffSections, type AgentConfig } from '@/lib/agent'
import {
  discardReceptionistDraft,
  fetchReceptionistState,
  patchReceptionistDraft,
  pauseReceptionist,
  publishReceptionist,
  resumeReceptionist,
  type ReceptionistStateDto,
} from '@/lib/receptionist-api'

export type AgentStatus = ReceptionistStateDto['status'] | 'publishing'

type AgentCtx = {
  agentId: string
  live: AgentConfig
  draft: AgentConfig
  status: AgentStatus
  draftRevision: number
  lastSaved: string
  lastPublished: string
  unsaved: boolean
  loading: boolean
  error: string | null
  changes: { key: keyof AgentConfig; label: string }[]
  update: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K] | ((prev: AgentConfig[K]) => AgentConfig[K])) => void
  saveDraft: () => Promise<void>
  discardDraft: () => Promise<void>
  publish: (opts?: { fail?: boolean }) => Promise<{ ok: boolean; errors?: string[] }>
  setPaused: (paused: boolean) => Promise<void>
  reload: () => Promise<void>
}

const Ctx = createContext<AgentCtx | null>(null)

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [live, setLive] = useState<AgentConfig>(DEFAULT_AGENT)
  const [draft, setDraft] = useState<AgentConfig>(DEFAULT_AGENT)
  const [status, setStatus] = useState<AgentStatus>('draft')
  const [draftRevision, setDraftRevision] = useState(1)
  const [lastSaved, setLastSaved] = useState('')
  const [lastPublished, setLastPublished] = useState('')
  const [unsaved, setUnsaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentId, setAgentId] = useState('')

  const applyState = useCallback((s: ReceptionistStateDto) => {
    setAgentId(s.agentId)
    setLive(s.live)
    setDraft(s.draft)
    setStatus(s.status)
    setDraftRevision(s.draftRevision)
    setLastSaved(s.lastSaved || '')
    setLastPublished(s.lastPublished || '')
    setUnsaved(s.unsaved)
    setError(null)
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const s = await fetchReceptionistState()
      applyState(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load receptionist')
    } finally {
      setLoading(false)
    }
  }, [applyState])

  useEffect(() => {
    void reload()
  }, [reload])

  const update = useCallback<AgentCtx['update']>((key, value) => {
    setDraft((d) => {
      if (!d) return d
      return {
        ...d,
        [key]: typeof value === 'function' ? (value as (p: unknown) => unknown)(d[key]) : value,
      } as AgentConfig
    })
    setUnsaved(true)
  }, [])

  const value = useMemo<AgentCtx>(() => {
    const changes = diffSections(live, draft)
    return {
      agentId,
      live,
      draft,
      status,
      draftRevision,
      lastSaved,
      lastPublished,
      unsaved,
      loading,
      error,
      changes,
      update,
      reload,
      saveDraft: async () => {
        const s = await patchReceptionistDraft(draft, draftRevision)
        applyState(s)
      },
      discardDraft: async () => {
        const s = await discardReceptionistDraft()
        applyState(s)
      },
      publish: async () => {
        setStatus('publishing')
        setError(null)
        try {
          if (unsaved) {
            const saved = await patchReceptionistDraft(draft, draftRevision)
            applyState(saved)
          }
          const result = await publishReceptionist()
          if (!result.ok) {
            setStatus('sync_failed')
            const errors = result.errors ?? []
            setError(errors.join(' ') || 'Publish failed')
            if (result.state) applyState(result.state)
            return { ok: false, errors }
          }
          if (result.state) applyState(result.state)
          return { ok: true }
        } catch (e) {
          setStatus('sync_failed')
          const message = e instanceof Error ? e.message : 'Publish failed'
          setError(message)
          return { ok: false, errors: [message] }
        }
      },
      setPaused: async (paused) => {
        const s = paused ? await pauseReceptionist() : await resumeReceptionist()
        applyState(s)
      },
    }
  }, [
    agentId,
    live,
    draft,
    status,
    draftRevision,
    lastSaved,
    lastPublished,
    unsaved,
    loading,
    error,
    update,
    reload,
    applyState,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAgent() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAgent must be used inside AgentProvider')
  return ctx
}
