'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionStudioClient } from '../../lib/motion-studio/client'
import { MotionStudioHttpError } from '../../lib/motion-studio/client'
import type { MsActivityEvent, MsProject } from '../../lib/motion-studio/types'

const ACTIVE = new Set(['planning', 'producing', 'exporting'])

export function needsPolling(p: MsProject | null): boolean {
  if (!p) return false
  return (
    ACTIVE.has(p.status) ||
    p.scenes.some((s) => s.status === 'rendering') ||
    p.assets.some((a) => a.analysis.status === 'queued' || a.analysis.status === 'analyzing')
  )
}

/** Loads one Motion Studio project, polls while work is running, and streams activity events. */
export function useMotionProject(client: MotionStudioClient, projectId: string, pollMs = 1500) {
  const [project, setProject] = useState<MsProject | null>(null)
  const [events, setEvents] = useState<MsActivityEvent[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const cursor = useRef<string | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([client.getProject(projectId), client.listActivity(projectId, cursor.current)])
      if (!alive.current) return
      setProject(p)
      setLoadError(null)
      if (a.events.length) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...a.events.filter((e) => !seen.has(e.id))]
        })
      }
      cursor.current = a.cursor
    } catch (err) {
      if (!alive.current) return
      const msg = err instanceof MotionStudioHttpError && err.status === 404 ? 'This project does not exist or you no longer have access.' : err instanceof Error ? err.message : 'Could not load the project.'
      setLoadError(msg)
    }
  }, [client, projectId])

  useEffect(() => {
    alive.current = true
    cursor.current = null
    setEvents([])
    void refresh()
    return () => {
      alive.current = false
    }
  }, [refresh])

  const polling = needsPolling(project)
  useEffect(() => {
    if (!polling || pollMs <= 0) return
    const t = setInterval(() => void refresh(), pollMs)
    return () => clearInterval(t)
  }, [polling, pollMs, refresh])

  /** Run a mutation; the returned project replaces local state. Errors stay visible with a recovery path. */
  const act = useCallback(
    async (label: string, fn: () => Promise<MsProject | void>): Promise<boolean> => {
      setBusy(label)
      setActionError(null)
      try {
        const next = await fn()
        if (next && alive.current) setProject(next)
        void refresh()
        return true
      } catch (err) {
        if (alive.current) setActionError(err instanceof Error ? err.message : 'Something went wrong. Try again.')
        return false
      } finally {
        if (alive.current) setBusy(null)
      }
    },
    [refresh],
  )

  return { project, events, loadError, actionError, setActionError, busy, act, refresh }
}
