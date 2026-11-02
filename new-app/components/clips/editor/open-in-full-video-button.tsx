'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

export function OpenInFullVideoButton({ clipId, hasUpload = true }: { clipId: string; hasUpload?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(hasUpload)

  useEffect(() => {
    if (!hasUpload) {
      setLoading(false)
      return
    }
    setLoading(true)
    void clipsFetch<{ projectId: string; clipId: string; url: string } | null>(`/api/clips/clips/${clipId}/full-video-link`)
      .then((data) => setUrl(data?.url ?? null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false))
  }, [clipId, hasUpload])

  if (!hasUpload) return null

  return (
    <Button
      size="sm"
      variant="outline"
      asChild={Boolean(url)}
      disabled={loading || !url}
      data-testid="open-in-full-video"
      title={loading ? 'Preparing full video…' : !url ? 'Full video is still processing' : undefined}
    >
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="mr-1 size-3.5" aria-hidden />
          Open in full video
        </a>
      ) : (
        <span>
          <ExternalLink className="mr-1 size-3.5" aria-hidden />
          {loading ? 'Opening…' : 'Full video…'}
        </span>
      )}
    </Button>
  )
}
