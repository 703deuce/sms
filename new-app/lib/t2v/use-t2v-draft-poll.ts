'use client'

import { useEffect, useRef } from 'react'

export function useT2vDraftPoll(
  draftId: string | null,
  enabled: boolean,
  onUpdate: (data: { status: string; stage: string | null; progress: number; error: string | null }) => void,
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const intervalMsRef = useRef(2000)
  const startedRef = useRef<number | null>(null)

  useEffect(() => {
    if (!draftId || !enabled) return
    startedRef.current = Date.now()
    intervalMsRef.current = 2000
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = (ms: number) => {
      if (cancelled) return
      timer = setTimeout(() => void tick(), ms)
    }

    const tick = async () => {
      if (cancelled) return
      try {
        const res = await fetch(`/api/t2v/drafts/${draftId}`)
        const body = await res.json()
        if (!res.ok) {
          schedule(intervalMsRef.current)
          return
        }
        const d = body.data
        onUpdateRef.current({
          status: d.status,
          stage: d.stage,
          progress: d.progress ?? 0,
          error: d.error,
        })
        if (d.status === 'DRAFT' && d.stage === 'failed') return
        if (d.status === 'READY') return

        const elapsed = Date.now() - (startedRef.current ?? Date.now())
        if (elapsed > 45 * 60 * 1000) {
          onUpdateRef.current({
            status: d.status,
            stage: 'timeout',
            progress: d.progress ?? 0,
            error: 'Build is taking longer than expected. You can leave and return later.',
          })
          intervalMsRef.current = Math.min(30_000, intervalMsRef.current + 2000)
        } else if (elapsed > 120_000) {
          intervalMsRef.current = 5000
        }
      } catch {
        /* ignore */
      }
      schedule(intervalMsRef.current)
    }

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [draftId, enabled])
}
