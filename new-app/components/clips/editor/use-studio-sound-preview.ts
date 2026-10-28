'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

const POLL_MS = 2000
const TIMEOUT_MS = 120_000

export function useStudioSoundPreview(opts: {
  clipId: string
  generationId: string | null
  jobId: string | null
  enabled: boolean
  onReady: (downloadUrl: string) => void
  onFailed: () => void
}) {
  const { clipId, generationId, jobId, enabled, onReady, onFailed } = opts
  const [loading, setLoading] = useState(false)
  const failToastRef = useRef(false)
  const startedRef = useRef<number | null>(null)

  const poll = useCallback(async () => {
    if (!enabled || !generationId) return
    if (jobId) {
      try {
        const job = await clipsFetch<{ status: string; progress?: unknown }>(
          `/api/clips/clips/${clipId}/studio-sound/jobs/${jobId}`,
        )
        if (job.status === 'FAILED') {
          setLoading(false)
          if (!failToastRef.current) {
            failToastRef.current = true
            toast.error('Studio Sound failed, try again')
            onFailed()
          }
          return
        }
      } catch {
        /* generation poll is source of truth */
      }
    }
    const gen = await clipsFetch<{
      status: string
      downloadUrl: string | null
      error: string | null
    }>(`/api/clips/generations/${generationId}`)
    if (gen.status === 'READY' && gen.downloadUrl) {
      setLoading(false)
      onReady(gen.downloadUrl)
      return
    }
    if (gen.status === 'FAILED') {
      setLoading(false)
      if (!failToastRef.current) {
        failToastRef.current = true
        toast.error(gen.error || 'Studio Sound failed, try again')
        onFailed()
      }
    }
  }, [clipId, enabled, generationId, jobId, onFailed, onReady])

  useEffect(() => {
    if (!enabled || !generationId) {
      setLoading(false)
      startedRef.current = null
      failToastRef.current = false
      return
    }
    failToastRef.current = false
    setLoading(true)
    startedRef.current = Date.now()
    const tick = () => {
      void poll().catch(() => {})
    }
    tick()
    const t = setInterval(tick, POLL_MS)
    return () => clearInterval(t)
  }, [enabled, generationId, poll])

  useEffect(() => {
    if (!loading || !startedRef.current) return
    const elapsed = Date.now() - startedRef.current
    if (elapsed < TIMEOUT_MS) return
    setLoading(false)
    if (!failToastRef.current) {
      failToastRef.current = true
      toast.error('Studio Sound failed, try again')
      onFailed()
    }
  }, [loading, onFailed])

  return { loading }
}
