'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MotionStudioClient } from '../../lib/motion-studio/client'
import { MotionStudioHttpError } from '../../lib/motion-studio/client'
import type { MsActivityEvent, MsProject } from '../../lib/motion-studio/types'
import { startPolling } from '../../lib/motion-studio/poll'

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
export function useMotionProject(client: MotionStudioClient, projectId: string, pollMs = 5000) {
  const [project, setProject] = useState<MsProject | null>(null)
  const [events, setEvents] = useState<MsActivityEvent[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  /** HTTP status of the last failed load (404 = not found / other workspace, 401 = no session). */
  const [loadStatus, setLoadStatus] = useState<number | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const cursor = useRef<string | null>(null)
  const alive = useRef(true)
  const lastBusy = useRef(false)
  const refreshInFlight = useRef<Promise<boolean> | null>(null)

  const refresh = useCallback((): Promise<boolean> => {
    // A slow read must never accumulate overlapping database requests: callers
    // (poller, mutations, first load) share the in-flight refresh.
    if (refreshInFlight.current) return refreshInFlight.current
    const request = (async (): Promise<boolean> => {
    try {
      const [p, a] = await Promise.all([client.getProject(projectId), client.listActivity(projectId, cursor.current)])
      if (!alive.current) return false
      setProject(p)
      setLoadError(null)
      setLoadStatus(null)
      if (a.events.length) {
        setEvents((prev) => {
          const seen = new Set(prev.map((e) => e.id))
          return [...prev, ...a.events.filter((e) => !seen.has(e.id))]
        })
      }
      cursor.current = a.cursor
      lastBusy.current = false
      return true
    } catch (err) {
      if (!alive.current) return false
      // Server busy (503): keep the last good project on screen; the poller backs off.
      lastBusy.current = err instanceof MotionStudioHttpError && err.status === 503
      if (lastBusy.current) return false
      const status = err instanceof MotionStudioHttpError ? err.status : null
      const msg =
        status === 404
          ? 'This project does not exist or belongs to another workspace.'
          : status === 401
            ? 'Your session has ended. Refresh the page to sign in again.'
            : err instanceof Error
              ? err.message
              : 'Could not load the project.'
      setLoadStatus(status)
      setLoadError(msg)
      return false
    }
    })()
    refreshInFlight.current = request
    void request.finally(() => {
      if (refreshInFlight.current === request) refreshInFlight.current = null
    })
    return request
  }, [client, projectId])

  useEffect(() => {
    alive.current = true
    cursor.current = null
    setEvents([])
    // First load; if the server answers 503 (busy) retry with backoff instead of failing the page.
    const stop = startPolling(async () => {
      if (await refresh()) return false
      if (lastBusy.current) throw new Error('busy')
      return false
    }, { immediate: true })
    return () => {
      alive.current = false
      stop()
    }
  }, [refresh])

  const polling = needsPolling(project)
  useEffect(() => {
    if (!polling || pollMs <= 0) return
    // Sequential, >= 5s, backs off on errors, pauses in hidden tabs; stops when work finishes
    // (`polling` flips false and this effect is torn down).
    return startPolling(async () => {
      if (!(await refresh())) throw new Error('refresh failed')
    }, { intervalMs: pollMs, maxIntervalMs: 60_000 })
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

  return { project, events, loadError, loadStatus, actionError, setActionError, busy, act, refresh }
}
