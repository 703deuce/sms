'use client'

import { useEffect, useRef } from 'react'

export function useT2vDraftPoll(
  draftId: string | null,
  enabled: boolean,
  onUpdate: (data: { status: string; stage: string | null; progress: number; error: string | null }) => void,
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate
  const intervalMs = useRef(2000)
  const started = useRef<number | null>(null)

  useEffect(() => {
    if (!draftId || !enabled) return
    started.current = Date.now()
    intervalMs.current = 2000
    let timer: ReturnType<typeof setInterval> | null = null

    const tick = async () => {
      try {
        const res = await fetch(`/api/t2v/drafts/${draftId}`)
        const body = await res.json()
        if (!res.ok) return
        const d = body.data
        onUpdateRef.current({
          status: d.status,
          stage: d.stage,
          progress: d.progress ?? 0,
          error: d.error,
        })
        if (d.status === 'DRAFT' && d.stage === 'failed') {
          if (timer) clearInterval(timer)
          return
        }
        if (d.status === 'READY') {
          if (timer) clearInterval(timer)
          return
        }
        const elapsed = Date.now() - (started.current ?? Date.now())
        if (elapsed > 45 * 60 * 1000) {
          onUpdateRef.current({
            status: d.status,
            stage: 'timeout',
            progress: d.progress ?? 0,
            error: 'Build is taking longer than expected. You can leave and return later.',
          })
          intervalMs.current = Math.min(30_000, intervalMs.current + 2000)
        } else if (elapsed > 120_000) {
          intervalMs.current = 5000
        }
      } catch {
        /* ignore */
      }
    }

    void tick()
    timer = setInterval(() => void tick(), intervalMs.current)
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [draftId, enabled])
}
