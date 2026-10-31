'use client'

import { useState } from 'react'
import { Captions } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { ProjectMediaApi } from '@/components/clips/editor/use-project-media'
import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import type { MediaTranscriptEstimate } from '@/lib/clips/editor/media-words'
import { formatMediaDuration } from '@/lib/clips/media-transcribe-cost'
import { creditsLabel } from '@/lib/clips/credit-cost'

/**
 * E5b: "Transcribe" on a library card (uploaded video or Rooms take). The first click only fetches
 * and SHOWS the cost in CREDITS (never $); the transcription runs after the user confirms it.
 */
export function MediaTranscribeControl({ media, item }: { media: ProjectMediaApi; item: ProjectMediaItem }) {
  const [estimate, setEstimate] = useState<MediaTranscriptEstimate | null>(null)
  const [busy, setBusy] = useState(false)
  if (!media.estimateTranscript || !media.transcribe) return null
  if (item.isMain || item.mediaType !== 'video') return null
  const tr = media.transcripts?.find((t) => t.refId === item.refId)
  if (tr?.status === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground" data-testid="media-transcript-done" title="Words join the transcript where this clip's own sound plays">
        <Captions className="size-3" />
        {tr.words.length} words
      </span>
    )
  }
  if (tr && (tr.status === 'queued' || tr.status === 'running')) {
    return <span className="text-[10px] text-muted-foreground" data-testid="media-transcript-running">Transcribing…</span>
  }
  if (estimate) {
    return (
      <div className="flex w-full flex-wrap items-center gap-1 rounded bg-muted/60 p-1 text-[10px]" data-testid="media-transcribe-confirm">
        <span className="min-w-0 flex-1">
          Transcribe {estimate.durationKnown && estimate.durationMs ? formatMediaDuration(estimate.durationMs) : 'this clip'} for{' '}
          <strong data-testid="media-transcribe-cost">{creditsLabel(estimate.credits)}</strong>?
        </span>
        <Button
          size="xs"
          className="h-6 px-1.5 text-[10px]"
          disabled={busy}
          data-testid="media-transcribe-run"
          onClick={async () => {
            setBusy(true)
            try {
              await media.transcribe?.(item, estimate.credits)
              setEstimate(null)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Could not start the transcription')
            } finally {
              setBusy(false)
            }
          }}
        >
          Transcribe
        </Button>
        <Button size="xs" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setEstimate(null)}>
          Cancel
        </Button>
      </div>
    )
  }
  return (
    <Button
      size="xs"
      variant="ghost"
      className="h-6 px-1.5 text-[10px]"
      disabled={busy}
      data-testid="media-transcribe"
      title={tr?.status === 'failed' ? `Last try failed: ${tr.error ?? 'error'}` : 'See the cost, then transcribe this clip'}
      onClick={async () => {
        setBusy(true)
        try {
          setEstimate(await media.estimateTranscript!(item))
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Could not get the cost')
        } finally {
          setBusy(false)
        }
      }}
    >
      <Captions className="size-3" />
      {tr?.status === 'failed' ? 'Retry transcript' : 'Transcribe'}
    </Button>
  )
}
