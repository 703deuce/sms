'use client'

import { useEffect, useRef } from 'react'

export function useT2vDraftPoll(
  draftId: string | null,
  enabled: boolean,
  onUpdate: (data: { status: string; stage: string | null; progress: number; error: string | null }) => void,
) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!draftId || !enabled) return
    const tick = async () => {
      try {
        const res = await fetch(`/api/t2v/drafts/${draftId}`)
        const body = await res.json()
        if (!res.ok) return
        const d = body.data
        onUpdate({
          status: d.status,
          stage: d.stage,
          progress: d.progress ?? 0,
          error: d.error,
        })
      } catch {
        /* ignore */
      }
    }
    void tick()
    timer.current = setInterval(() => void tick(), 2000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [draftId, enabled, onUpdate])
}
