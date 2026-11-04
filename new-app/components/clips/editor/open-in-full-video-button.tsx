'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
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

/** FIX1 (F8): click-only (no hover prefetch: the route creates projects), navigate as soon as the link resolves. */
export function useOpenInFullVideo(clipId: string, hasUpload = true) {
  const router = useRouter()
  const [progress, setProgress] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      if (pollRef.current) clearTimeout(pollRef.current)
    }
  }, [])

  const load = useCallback(
    async (attempt: number) => {
      try {
        const data = await clipsFetch<FullVideoLinkData | null>(`/api/clips/clips/${clipId}/full-video-link`)
        if (!aliveRef.current) return
        if (data && 'url' in data && data.url) {
          clearPersisted(clipId)
          setProgress(null)
          setLoading(false)
          router.push(data.url)
          return
        }
        if (data && 'preparing' in data && data.preparing) {
          const msg = data.message || 'Preparing full video…'
          setProgress(msg)
          persistPreparing(clipId, msg)
          pollRef.current = setTimeout(() => void load(attempt + 1), Math.min(2500 + attempt * 200, 8000))
          return
        }
        clearPersisted(clipId)
        setProgress(null)
        setLoading(false)
      } catch {
        if (!aliveRef.current) return
        setProgress(null)
        setLoading(false)
      }
    },
    [clipId, router],
  )

  const open = useCallback(() => {
    if (!hasUpload || loading) return
    setLoading(true)
    setProgress(readPersisted(clipId) ?? 'Opening…')
    void load(0)
  }, [clipId, hasUpload, load, loading])

  return { loading, progress, open }
}

export function OpenInFullVideoButton({ clipId, hasUpload = true }: { clipId: string; hasUpload?: boolean }) {
  const { loading, progress, open } = useOpenInFullVideo(clipId, hasUpload)
  if (!hasUpload) return null
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={loading}
      data-testid="open-in-full-video"
      title={progress ?? undefined}
      onClick={(e) => {
        e.stopPropagation()
        open()
      }}
    >
      <ExternalLink className="mr-1 size-3.5 shrink-0" aria-hidden />
      <span className="max-w-[220px] truncate max-[1499px]:sr-only">{loading ? progress || 'Opening…' : 'Open in full video'}</span>
    </Button>
  )
}
