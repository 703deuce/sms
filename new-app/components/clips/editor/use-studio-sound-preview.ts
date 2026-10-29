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
  const [studioSlow, setStudioSlow] = useState(false)
  const failToastRef = useRef(false)
  const startedRef = useRef<number | null>(null)

  const retryPoll = useCallback(() => {
    failToastRef.current = false
    setStudioSlow(false)
    setLoading(true)
    startedRef.current = Date.now()
  }, [])

  const poll = useCallback(async () => {
    if (!enabled || !generationId) return
    if (jobId) {
      try {
        const job = await clipsFetch<{ status: string; progress?: unknown }>(
          `/api/clips/clips/${clipId}/studio-sound/jobs/${jobId}`,
        )
        if (job.status === 'FAILED') {
          setLoading(false)
          setStudioSlow(false)
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
      setStudioSlow(false)
      onReady(gen.downloadUrl)
      return
    }
    if (gen.status === 'FAILED') {
      setLoading(false)
      setStudioSlow(false)
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
      setStudioSlow(false)
      startedRef.current = null
      failToastRef.current = false
      return
    }
    failToastRef.current = false
    setStudioSlow(false)
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
    const started = startedRef.current
    const delay = Math.max(0, TIMEOUT_MS - (Date.now() - started))
    const timer = setTimeout(() => {
      if (!startedRef.current || startedRef.current !== started) return
      setLoading(false)
      setStudioSlow(true)
      console.info('[clipper:studio] still_processing', {
        clipId,
        generationId,
        elapsedMs: Date.now() - started,
      })
    }, delay)
    return () => clearTimeout(timer)
  }, [clipId, generationId, loading])

  return { loading, studioSlow, retryPoll }
}
