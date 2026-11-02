'use client'

import { useEffect, useRef, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

type FullVideoLinkData =
  | { projectId: string; clipId: string; url: string; sourceMs: number; preparing?: false }
  | { preparing: true; stage: 'project' | 'clip'; message: string; projectId?: string }

const STORAGE_PREFIX = 'clip-open-fv:'

function readPersisted(clipId: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${clipId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { message?: string }
    return typeof parsed.message === 'string' ? parsed.message : 'Preparing full video…'
  } catch {
    return null
  }
}

function persistPreparing(clipId: string, message: string) {
  try {
    sessionStorage.setItem(`${STORAGE_PREFIX}${clipId}`, JSON.stringify({ since: Date.now(), message }))
  } catch {
    /* ignore */
  }
}

function clearPersisted(clipId: string) {
  try {
    sessionStorage.removeItem(`${STORAGE_PREFIX}${clipId}`)
  } catch {
    /* ignore */
  }
}

export function OpenInFullVideoButton({ clipId, hasUpload = true }: { clipId: string; hasUpload?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(() => readPersisted(clipId))
  const [loading, setLoading] = useState(hasUpload)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!hasUpload) {
      setLoading(false)
      return
    }

    let cancelled = false

    const load = async (attempt = 0) => {
      try {
        const data = await clipsFetch<FullVideoLinkData | null>(`/api/clips/clips/${clipId}/full-video-link`)
        if (cancelled) return
        if (data && 'url' in data && data.url) {
          setUrl(data.url)
          setProgress(null)
          clearPersisted(clipId)
          setLoading(false)
          return
        }
        if (data && 'preparing' in data && data.preparing) {
          const msg = data.message || 'Preparing full video…'
          setProgress(msg)
          persistPreparing(clipId, msg)
          setLoading(true)
          pollRef.current = setTimeout(() => void load(attempt + 1), Math.min(2500 + attempt * 200, 8000))
          return
        }
        setProgress(null)
        clearPersisted(clipId)
        setLoading(false)
      } catch {
        if (!cancelled) {
          setProgress(null)
          setLoading(false)
        }
      }
    }

    setLoading(true)
    if (!progress) setProgress(readPersisted(clipId))
    void load(0)

    return () => {
      cancelled = true
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [clipId, hasUpload])

  if (!hasUpload) return null

  const label = url
    ? 'Open in full video'
    : loading
      ? progress || 'Preparing full video…'
      : 'Full video unavailable'

  return (
    <Button
      size="sm"
      variant="outline"
      asChild={Boolean(url)}
      disabled={loading || !url}
      data-testid="open-in-full-video"
      title={progress ?? undefined}
    >
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-1 size-3.5" aria-hidden />
          Open in full video
        </a>
      ) : (
        <span className="max-w-[220px] truncate">
          <ExternalLink className="mr-1 size-3.5 shrink-0" aria-hidden />
          {label}
        </span>
      )}
    </Button>
  )
}
