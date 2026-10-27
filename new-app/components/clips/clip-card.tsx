'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScoreRing } from '@/components/clips/ui/score-ring'
import { DurationChip } from '@/components/clips/ui/duration-chip'
import type { ClipCardData } from '@/components/clips/clip-grid'
import { clipsFetch } from '@/lib/clips-api'
import { formatDur, formatTimecode } from '@/lib/clips/format'
import { ReasonChips } from '@/components/streamer/reason-chips'
import { ClipCardVideo } from '@/components/clips/clip-card-video'
import {
  clipLayoutChip,
  clipPersonCount,
  clipWhySummary,
  type ClipAiMeta,
} from '@/lib/clips/clip-results-chips'
import { ThumbsDown, EyeOff } from 'lucide-react'

export function ClipCard({
  clip,
  projectId,
  onDownload,
  onHidden,
  isStreamer = false,
}: {
  clip: ClipCardData
  projectId: string
  onDownload: (clipId: string) => void
  onHidden?: (clipId: string) => void
  isStreamer?: boolean
}) {
  const [thumbBusy, setThumbBusy] = useState(false)
  const [hideBusy, setHideBusy] = useState(false)
  const aiMeta = (clip.aiMeta || {}) as ClipAiMeta
  const why = clipWhySummary(aiMeta)
  const layoutChip = clipLayoutChip(aiMeta)
  const people = clipPersonCount(aiMeta)

  const hideClip = async () => {
    if (!onHidden) return
    setHideBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${clip.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ hidden: true, disliked: true }),
      })
      toast.success('Clip hidden')
      onHidden(clip.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not hide clip')
    } finally {
      setHideBusy(false)
    }
  }
  const makeThumbnail = async () => {
    setThumbBusy(true)
    try {
      await clipsFetch(`/api/clips/clips/${clip.id}/thumbnail`, {
        method: 'POST',
        body: JSON.stringify({ aspect: '9:16' }),
      })
      toast.success('Thumbnail generation started — open editor to pick a cover')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Thumbnail failed')
    } finally {
      setThumbBusy(false)
    }
  }
  const scores = (clip.scores || {}) as Record<string, string>
  const streamerReasons =
    (clip.aiMeta as { streamer?: { reasons?: { kind: string; label: string; value?: string }[] } })?.streamer
      ?.reasons ?? []
  const showClipperDims =
    !isStreamer && !streamerReasons.length && (scores.hook || scores.flow || scores.value || scores.trend)
  const dims = [
    ['Hook', scores.hook],
    ['Flow', scores.flow],
    ['Value', scores.value],
    ['Trend', scores.trend],
  ] as const

  return (
    <article
      id={`clip-card-${clip.id}`}
      data-testid="clip-card"
      className="group flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card shadow-xs transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <div className="relative aspect-[9/16] bg-muted">
        {clip.previewUrl || clip.posterUrl ? (
          <ClipCardVideo clipId={clip.id} previewUrl={clip.previewUrl} posterUrl={clip.posterUrl} />
        ) : null}
        <div className="absolute left-2 top-2" title={why ?? undefined}>
          <ScoreRing score={clip.score} />
        </div>
        {onHidden ? (
          <button
            type="button"
            disabled={hideBusy}
            onClick={() => void hideClip()}
            className="absolute right-2 top-2 rounded-md bg-black/55 p-1.5 text-white opacity-0 ring-1 ring-white/20 transition group-hover:opacity-100 focus:opacity-100"
            aria-label="Hide clip"
          >
            <EyeOff className="size-4" aria-hidden />
          </button>
        ) : null}
        <DurationChip ms={clip.durationMs} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug break-words">{clip.title}</h3>
        <p className="text-xs text-muted-foreground tabular-nums">
          Source {formatTimecode(clip.startMs)}–{formatTimecode(clip.endMs)} · {formatDur(clip.durationMs)} · score {clip.score}
        </p>
        {(() => {
          const meta = (clip.aiMeta as { streamer?: { meta?: { game?: string; vodUrlAt?: string } } })?.streamer?.meta
          if (!meta?.game && !meta?.vodUrlAt) return null
          return (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {meta.game ? (
                <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary">{meta.game}</span>
              ) : null}
              {meta.vodUrlAt ? (
                <a href={meta.vodUrlAt} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  VOD {formatTimecode(clip.startMs)} ↗
                </a>
              ) : null}
            </div>
          )
        })()}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary tabular-nums">
            Score {clip.score}
          </span>
          {layoutChip ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {layoutChip}
            </span>
          ) : null}
          {people != null && people > 1 ? (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {people} people
            </span>
          ) : null}
          {showClipperDims
            ? dims.map(([label, grade]) => (
                <span
                  key={label}
                  className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {label} {grade ?? '—'}
                </span>
              ))
            : null}
        </div>
        {why || clip.reason ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">{why || clip.reason}</p>
        ) : null}
        <ReasonChips
          score={isStreamer ? clip.score : undefined}
          reasons={streamerReasons}
        />
        {isStreamer && !streamerReasons.length ? (
          <p className="text-[10px] text-muted-foreground">No signal chips (chat or replay may be unavailable).</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="default" render={<Link href={`/app/clips/${projectId}/edit/${clip.id}`} />}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="secondary"
            data-testid="edit-in-script-editor"
            render={<Link href={`/app/clips/${projectId}/script?clipId=${clip.id}`} />}
          >
            Script editor
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDownload(clip.id)}>Download</Button>
          <Button size="sm" variant="outline" disabled={thumbBusy} onClick={() => void makeThumbnail()}>
            Make thumbnail
          </Button>
          {onHidden ? (
            <Button size="sm" variant="ghost" disabled={hideBusy} onClick={() => void hideClip()}>
              <ThumbsDown className="mr-1 size-3.5" aria-hidden />
              Not for me
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  )
}
