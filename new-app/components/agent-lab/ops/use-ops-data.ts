'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Overview } from '@/lib/agent-lab/ops'

export type Loadable<T> = { data: T | null; error: string | null; loading: boolean; reload: () => void }

/** Polls one JSON endpoint (default every 20 s) while the tab is visible. */
export function usePolled<T>(url: string | null, intervalMs = 20_000): Loadable<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(Boolean(url))
  const alive = useRef(true)

  const load = useCallback(async () => {
    if (!url) return
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as T & { error?: string }
      if (!alive.current) return
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
      setData(body)
      setError(null)
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      if (alive.current) setLoading(false)
    }
  }, [url])

  useEffect(() => {
    alive.current = true
    void load()
    if (!url) return () => {
      alive.current = false
    }
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load()
    }, intervalMs)
    return () => {
      alive.current = false
      clearInterval(t)
    }
  }, [load, url, intervalMs])

  return { data, error, loading, reload: () => void load() }
}

export function useOverview(): Loadable<Overview> {
  return usePolled<Overview>('/api/agent-lab/overview')
}
