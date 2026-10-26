'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScoreBadge } from '@/components/clips/score-badge'
import type { ClipCardData } from '@/components/clips/clip-grid'

function formatClock(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDur(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export function ClipCard({
  clip,
  projectId,
  onDownload,
}: {
  clip: ClipCardData
  projectId: string
  onDownload: (clipId: string) => void
}) {
  const scores = (clip.scores || {}) as Record<string, string>
  const dims = [
    ['Hook', scores.hook],
    ['Flow', scores.flow],
    ['Value', scores.value],
    ['Trend', scores.trend],
  ] as const

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
            onMouseEnter={(e) => {
              void fetch(`/api/clips/clips/${clip.id}/events`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventType: 'preview_play' }),
              }).catch(() => {})
              e.currentTarget.play().catch(() => {})
            }}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
        ) : null}
        <div className="absolute left-2 top-2">
          <ScoreBadge score={clip.score} scores={scores} />
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug break-words">{clip.title}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          Source {formatClock(clip.startMs)}–{formatClock(clip.endMs)} · {formatDur(clip.durationMs)} · score {clip.score}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {dims.map(([label, grade]) => (
            <span key={label} className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {label} {grade ?? '—'}
            </span>
          ))}
        </div>
        {clip.reason ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{clip.reason}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" render={<Link href={`/app/clips/${projectId}/edit/${clip.id}`} />}>
            Edit
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDownload(clip.id)}>Download</Button>
        </div>
      </div>
    </article>
  )
}
