'use client'

import { Button } from '@/components/ui/button'
import { ScoreBadge } from '@/components/clips/score-badge'
import type { ClipCardData } from '@/components/clips/clip-grid'

function formatDur(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function ClipCard({
  clip,
  onDownload,
}: {
  clip: ClipCardData
  onDownload: (clipId: string) => void
}) {
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border surface overflow-hidden">
      <div className="relative aspect-[9/16] bg-muted">
        {clip.posterUrl ? (
          <video
            className="size-full object-cover"
            poster={clip.posterUrl}
            src={clip.previewUrl || undefined}
            muted
            playsInline
            loop
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
        ) : null}
        <div className="absolute left-2 top-2">
          <ScoreBadge score={clip.score} scores={clip.scores as Record<string, string>} />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium">{clip.title}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">{formatDur(clip.durationMs)}</p>
        <Button size="sm" variant="outline" onClick={() => onDownload(clip.id)}>Download</Button>
      </div>
    </article>
  )
}
