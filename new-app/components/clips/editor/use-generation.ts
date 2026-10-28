'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'
import { toast } from 'sonner'

export function useGeneration(generationId: string | null, pollIntervalMs = 2000) {
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const failedToastRef = useRef<string | null>(null)

  const poll = useCallback(async () => {
    if (!generationId) return
    const res = await clipsFetch<{
      status: string
      downloadUrl: string | null
      error: string | null
    }>(`/api/clips/generations/${generationId}`)
    setStatus(res.status)
    setDownloadUrl(res.downloadUrl)
    setError(res.error)
    if (res.status === 'READY' || res.status === 'FAILED') {
      return true
    }
    return false
    if (res.status === 'FAILED' && failedToastRef.current !== generationId) {
      failedToastRef.current = generationId
      toast.error(res.error || 'Generation failed', {
        action: {
          label: 'Try again',
          onClick: () => {
            failedToastRef.current = null
          },
        },
      })
    }
  }, [generationId])

  useEffect(() => {
    if (!generationId) {
      setStatus(null)
      setDownloadUrl(null)
      setError(null)
      return
    }
    failedToastRef.current = null
    const tick = () => {
      void poll()
        .then((done) => {
          if (done) clearInterval(t)
        })
        .catch(() => {})
    }
    const t = setInterval(tick, pollIntervalMs)
    tick()
    return () => clearInterval(t)
  }, [generationId, poll, pollIntervalMs])

  useEffect(() => {
    if (!generationId || !status) return
    if (status === 'FAILED' || status === 'READY') {
      return
    }
  }, [generationId, status])

  const running = status === 'PENDING' || status === 'RUNNING'

  return { status, downloadUrl, error, refresh: poll, running, failed: status === 'FAILED' }
}
