'use client'

import { useEffect, useRef } from 'react'

export type T2vPollUpdate = {
  status: string
  stage: string | null
  progress: number
  error: string | null
  builtVideoUrl?: string | null
}

export function useT2vDraftPoll(
  draftId: string | null,
  enabled: boolean,
  onUpdate: (data: T2vPollUpdate) => void,
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

    const pollInterval = () => (document.hidden ? 8000 : intervalMsRef.current)

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
          console.error('[t2v:build-progress] poll failed', { draftId, status: res.status })
          schedule(pollInterval())
          return
        }
        const d = body.data
        onUpdateRef.current({
          status: d.status,
          stage: d.stage,
          progress: d.progress ?? 0,
          error: d.error,
          builtVideoUrl: d.builtVideoUrl ?? null,
        })
        if (d.status === 'DRAFT' && d.stage === 'failed') return
        if (d.status === 'READY') {
          console.info('[t2v:build-progress] build READY', { draftId, stage: d.stage, progress: d.progress })
          return
        }

        const elapsed = Date.now() - (startedRef.current ?? Date.now())
        if (elapsed > 45 * 60 * 1000) {
          console.error('[t2v:build-progress] poll timeout', { draftId, elapsedMs: elapsed })
          onUpdateRef.current({
            status: d.status,
            stage: 'timeout',
            progress: d.progress ?? 0,
            error: 'Build is taking longer than expected. You can leave and return later.',
          })
          return
        } else if (elapsed > 120_000) {
          intervalMsRef.current = 5000
        }
      } catch (e) {
        console.error('[t2v:build-progress] poll error', {
          draftId,
          message: e instanceof Error ? e.message : String(e),
        })
      }
      schedule(pollInterval())
    }

    const onVisibility = () => {
      if (!document.hidden) {
        console.info('[t2v:build-progress] tab focused, refetch', { draftId })
        void tick()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    void tick()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [draftId, enabled])
}
