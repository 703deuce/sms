'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { clipsFetch } from '@/lib/clips-api'

export function useGeneration(generationId: string | null) {
  const [status, setStatus] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const poll = useCallback(async () => {
    if (!generationId) return
    const data = await clipsFetch<{
      status: string
      downloadUrl: string | null
      error: string | null
    }>(`/api/clips/generations/${generationId}`)
    setStatus(data.status)
    setDownloadUrl(data.downloadUrl)
    setError(data.error)
  }, [generationId])

  useEffect(() => {
    if (!generationId) return
    const t = setInterval(() => void poll().catch(() => {}), 5000)
    void poll()
    return () => clearInterval(t)
  }, [generationId, poll])

  return { status, downloadUrl, error, refresh: poll }
}
