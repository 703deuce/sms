'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { isWordCut, wordDisplayText } from '@/lib/clips/edits'
import { buildCaptionWords } from '@/lib/clips/caption-words'
import { editorPreviewEdits } from '@/lib/clips/editor-preview-edits'
import { groupWordbarItems, type TimelineWordChip } from '@/lib/clips/script-editor/timeline-model'
import {
  clampPxPerSec,
  fitPxPerSec,
  initialPxPerSec,
  readablePxPerSec,
  timelineMinPxPerSec,
  TIMELINE_MIN_LABEL_PX,
  zoomBy,
  zoomPercent,
} from '@/lib/clips/editor/timeline-zoom'
import type { AudioPeaks } from '@/components/clips/editor/use-audio-peaks'
import { TimelineWaveform } from '@/components/clips/editor/timeline/timeline-waveform'
import { TimelineFilmstrip } from '@/components/clips/editor/timeline/timeline-filmstrip'
import { useFilmstripFrames } from '@/components/clips/editor/timeline/use-filmstrip-frames'
import type { EditorAssets } from '@/lib/clips/editor/editor-assets'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { cn } from '@/lib/utils'

const THUMB_H = 44
const WORD_H = 18
const WAVE_H = 36
const PAD = 4

/** Script view: Descript-style compact timeline (~140px) — filmstrip, word chips, waveform. */
export function ScriptViewCompactTimeline({
  peaks,
  edits,
  words,
  trimInMs,
  trimOutMs,
  mediaOffsetMs,
  outputDurationMs,
  outputMs,
  videoUrl,
  posterUrl,
  editorAssets,
  onSeekOutput,
  className,
}: {
  peaks: AudioPeaks
  edits: ClipEditsV2
  words: SourceWord[]
  trimInMs: number
  trimOutMs: number
  mediaOffsetMs: number
  outputDurationMs: number
  outputMs: number
  videoUrl: string | null
  posterUrl?: string | null
  editorAssets?: EditorAssets | null
  onSeekOutput: (ms: number) => void
  className?: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [viewportPx, setViewportPx] = useState(320)
  const spanMs = Math.max(1, outputDurationMs)
  const minPx = useMemo(() => timelineMinPxPerSec(spanMs, viewportPx), [spanMs, viewportPx])
  const readableWords = useMemo(() => {
    const caps = buildCaptionWords(words, editorPreviewEdits(edits, words))
    return caps.map((c) => ({ text: c.text, durMs: Math.max(1, c.e_ms - c.s_ms) }))
  }, [edits, words])
  const [pxPerSec, setPxPerSec] = useState(() =>
    initialPxPerSec(spanMs, 320, readablePxPerSec(readableWords), minPx),
  )
  useEffect(() => {
    setPxPerSec((p) => clampPxPerSec(p, minPx))
  }, [minPx])
  const pxPerMs = pxPerSec / 1000
  const widthPx = Math.max(viewportPx, spanMs * pxPerMs)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setViewportPx(Math.max(1, el.clientWidth)))
    ro.observe(el)
    setViewportPx(Math.max(1, el.clientWidth))
    return () => ro.disconnect()
  }, [])

  const xs = (outMs: number) => outMs * pxPerMs
  const xe = (outMs: number) => outMs * pxPerMs

  const previewEdits = useMemo(() => editorPreviewEdits(edits, words), [edits, words])
  const captionWords = useMemo(() => buildCaptionWords(words, previewEdits), [words, previewEdits])
  const wordChips: TimelineWordChip[] = useMemo(
    () =>
      captionWords.map((c) => ({
        wordId: String(c.i),
        text: c.text,
        outStartMs: c.s_ms,
        outEndMs: Math.max(c.s_ms + 1, c.e_ms),
        deleted: false,
      })),
    [captionWords],
  )
  const cutGhostChips: TimelineWordChip[] = useMemo(() => {
    const trimSpan = Math.max(1, trimOutMs - trimInMs)
    const out: TimelineWordChip[] = []
    for (const w of words) {
      if (!isWordCut(w, edits.cutRanges)) continue
      const { midMs } = wordSourceMs(w)
      if (midMs < trimInMs || midMs > trimOutMs) continue
      const t = ((midMs - trimInMs) / trimSpan) * spanMs
      out.push({
        wordId: `cut-${w.i}`,
        text: wordDisplayText(w, edits.wordFixes),
        outStartMs: Math.max(0, t - 8),
        outEndMs: Math.min(spanMs, t + 8),
        deleted: true,
      })
    }
    return out
  }, [edits.cutRanges, edits.wordFixes, spanMs, trimInMs, trimOutMs, words])
  const allChips = useMemo(() => [...wordChips, ...cutGhostChips], [cutGhostChips, wordChips])
  const wordItems = useMemo(() => groupWordbarItems(allChips, pxPerMs), [allChips, pxPerMs])
  const wordByI = useMemo(() => new Map(words.map((w) => [String(w.i), w])), [words])

  const videoFrames = useFilmstripFrames(videoUrl)
  const filmstripSprite = editorAssets?.filmstrip ?? null
  const mediaFromMs = trimInMs - mediaOffsetMs
  const mediaToMs = trimOutMs - mediaOffsetMs

  const applyZoom = useCallback(
    (nextPxPerSec: number, anchorX?: number) => {
      const clamped = clampPxPerSec(nextPxPerSec, minPx)
      const el = scrollRef.current
      if (el && anchorX != null) {
        const before = el.scrollLeft
        const ratio = (before + anchorX) / Math.max(1, widthPx)
        setPxPerSec(clamped)
        requestAnimationFrame(() => {
          const w = Math.max(el.clientWidth, spanMs * (clamped / 1000))
          el.scrollLeft = Math.max(0, ratio * w - anchorX)
        })
        return
      }
      setPxPerSec(clamped)
    },
    [minPx, spanMs, widthPx],
  )

  const zoomIn = () => applyZoom(zoomBy(pxPerSec, 'in', undefined, minPx))
  const zoomOut = () => applyZoom(zoomBy(pxPerSec, 'out', undefined, minPx))
  const zoomFit = () => applyZoom(fitPxPerSec(spanMs, viewportPx, minPx))

  const seekFromClientX = (clientX: number, target: HTMLElement) => {
    if (outputDurationMs <= 0) return
    const rect = target.getBoundingClientRect()
    const x = scrollRef.current ? scrollRef.current.scrollLeft + (clientX - rect.left) : clientX - rect.left
    const ms = Math.max(0, Math.min(outputDurationMs, Math.round(x / pxPerMs)))
    onSeekOutput(ms)
  }

  const playheadLeft = outputDurationMs > 0 ? xs(outputMs) : 0

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col gap-1', className)} data-testid="script-view-compact-timeline">
      <div className="flex shrink-0 items-center justify-end gap-0.5 pr-1">
        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Zoom out" onClick={zoomOut}>
          <Minus className="size-3.5" />
        </Button>
        <span className="min-w-[2.5rem] text-center text-[10px] tabular-nums text-muted-foreground" data-testid="script-compact-zoom-pct">
          {zoomPercent(pxPerSec)}%
        </span>
        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Zoom in" onClick={zoomIn}>
          <Plus className="size-3.5" />
        </Button>
        <Button type="button" size="icon" variant="ghost" className="size-7" aria-label="Zoom to fit" onClick={zoomFit}>
          <Maximize2 className="size-3.5" />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="relative min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-md bg-muted/30"
        data-testid="script-compact-timeline-scroll"
        onClick={(e) => {
          if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.seekLayer === '1') {
            seekFromClientX(e.clientX, e.currentTarget)
          }
        }}
      >
        <div
          className="relative h-[calc(44px+18px+36px+8px)] min-w-full"
          style={{ width: widthPx }}
          data-seek-layer="1"
          role="presentation"
          onClick={(e) => seekFromClientX(e.clientX, scrollRef.current ?? e.currentTarget)}
        >
          <div className="absolute left-0 top-0 overflow-hidden rounded-t-sm" style={{ width: widthPx, height: THUMB_H }}>
            {videoUrl ? (
              <TimelineFilmstrip
                fromMs={mediaFromMs}
                toMs={mediaToMs}
                widthPx={widthPx}
                heightPx={THUMB_H}
                pxPerMs={pxPerMs}
                sprite={filmstripSprite}
                frames={videoFrames}
                stillUrl={posterUrl}
              />
            ) : null}
          </div>
          <div
            className="absolute left-0 overflow-hidden"
            style={{ top: THUMB_H + PAD / 2, width: widthPx, height: WORD_H }}
            role="group"
            aria-label="Transcript words"
          >
            {wordItems.map((wi) => {
              const left = xs(wi.outStartMs)
              const w = Math.max(1, xe(wi.outEndMs) - left)
              const id = wi.kind === 'word' ? wi.wordId : `g${wi.outStartMs}`
              const cut = wi.kind === 'word' && wi.wordId.startsWith('cut-')
              const label = wi.kind === 'word' ? wi.text : '…'
              return (
                <button
                  key={id}
                  type="button"
                  data-testid={cut ? 'script-compact-word-cut' : 'script-compact-word'}
                  className={cn(
                    wi.kind === 'word' ? 'pointer-events-auto' : 'pointer-events-none',
                    'absolute top-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-0.5 text-left text-[10px] leading-4 shadow-[inset_-1px_0_0_rgba(0,0,0,0.35)]',
                    cut
                      ? 'bg-destructive/35 text-destructive-foreground/90 line-through'
                      : 'bg-sky-500/75 text-white',
                  )}
                  style={{ left, width: w, height: WORD_H }}
                  onPointerDown={(ev) => ev.stopPropagation()}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    onSeekOutput(wi.outStartMs)
                  }}
                  title={wi.kind === 'word' && !cut ? wordByI.get(wi.wordId)?.w ?? label : label}
                >
                  {w >= TIMELINE_MIN_LABEL_PX ? label : null}
                </button>
              )
            })}
          </div>
          <div className="absolute left-0 overflow-hidden" style={{ top: THUMB_H + WORD_H + PAD, width: widthPx, height: WAVE_H }}>
            <TimelineWaveform
              peaks={peaks}
              mediaFromMs={mediaFromMs}
              mediaToMs={mediaToMs}
              widthPx={widthPx}
              className="size-full text-primary/70"
            />
          </div>
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 w-0.5 bg-primary shadow-sm"
            style={{ left: playheadLeft }}
            data-testid="script-compact-playhead"
          />
        </div>
      </div>
    </div>
  )
}
