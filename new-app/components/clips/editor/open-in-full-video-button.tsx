'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { clipsFetch } from '@/lib/clips-api'

export function OpenInFullVideoButton({ clipId }: { clipId: string }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    void clipsFetch<{ projectId: string; clipId: string; url: string } | null>(`/api/clips/clips/${clipId}/full-video-link`)
      .then((data) => setUrl(data?.url ?? null))
      .catch(() => setUrl(null))
  }, [clipId])

  if (!url) return null

  return (
    <Button size="sm" variant="outline" asChild data-testid="open-in-full-video">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <ExternalLink className="mr-1 size-3.5" aria-hidden />
        Open in full video
      </a>
    </Button>
  )
}
