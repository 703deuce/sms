'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ScriptFillerReviewBar,
  type FillerSearchOptions,
} from '@/components/script-editor/script-filler-review-bar'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { maxPlausibleGapMsForTrim, sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { gapShortenCutRange, listClipGapHits } from '@/lib/clips/gap-shorten'
import type { GapFilterMode } from '@/lib/clips/script-editor/gap-hits'
import { toast } from 'sonner'

const DEFAULT_SEARCH_OPTIONS: FillerSearchOptions = {
  autoAdvance: true,
  previewResults: true,
  matchWholeWords: false,
  matchCase: false,
  wrapAround: true,
  onlyCurrentComposition: false,
}

export function ClipGapReview({
  clipId,
  words,
  edits,
  open,
  onOpenChange,
  onAddCut,
  onSeek,
  minGapSec,
  maxGapSec,
  gapMode,
  targetGapSec,
  onTargetGapSecChange,
  clipBounds: clipBoundsProp,
}: {
  clipId: string
  words: SourceWord[]
  edits: ClipEditsV2
  clipBounds?: { clipStartMs: number; clipEndMs: number }
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddCut: (range: [number, number]) => void
  onSeek: (sourceMs: number) => void
  minGapSec: number
  maxGapSec: number
  gapMode: GapFilterMode
  targetGapSec: number
  onTargetGapSecChange: (n: number) => void
}) {
  const [gapCursor, setGapCursor] = useState(0)
  const [searchOptions, setSearchOptions] = useState<FillerSearchOptions>(DEFAULT_SEARCH_OPTIONS)

  const clipBounds = useMemo(
    () =>
      clipBoundsProp ?? { clipStartMs: edits.trim.in, clipEndMs: edits.trim.out },
    [clipBoundsProp, edits.trim.in, edits.trim.out],
  )
  const scopedWords = useMemo(
    () => sourceWordsForClipEditing(words, edits, clipBounds),
    [words, edits.trim.in, edits.trim.out, clipBounds],
  )
  const orderedWords = useMemo(
    () => editorWordsForClipFillerReview(clipId, words, edits, clipBounds),
    [clipId, words, edits.trim.in, edits.trim.out, clipBounds],
  )
  const cutRanges = edits.cutRanges ?? []
  const maxPlausibleGapMs = useMemo(() => maxPlausibleGapMsForTrim(edits.trim), [edits.trim.in, edits.trim.out])
  const wordSpans = useMemo(
    () =>
      scopedWords.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { s: startMs / 1000, e: endMs / 1000 }
      }),
    [scopedWords],
  )

  const targetGapMs = Math.round(targetGapSec * 1000)
  const gapHits = useMemo(
    () =>
      listClipGapHits(orderedWords, cutRanges, {
        mode: gapMode,
        minGapMs: Math.round(minGapSec * 1000),
        maxGapMs: gapMode === 'between' ? Math.round(maxGapSec * 1000) : undefined,
        targetGapMs,
        maxPlausibleGapMs,
      }),
    [orderedWords, cutRanges, gapMode, minGapSec, maxGapSec, targetGapMs, maxPlausibleGapMs],
  )

  useEffect(() => {
    if (gapCursor >= gapHits.length) setGapCursor(Math.max(0, gapHits.length - 1))
  }, [gapCursor, gapHits.length])

  useEffect(() => {
    if (!open) return
    const hit = gapHits[gapCursor]
    if (!hit) return
    const mid = hit.prevWord.t1Ms + hit.gapMs / 2
    onSeek(Math.round(mid))
  }, [open, gapCursor, gapHits, onSeek])

  const shortenHit = useCallback(
    (hit: { prevWord: { t1Ms: number }; word: { t0Ms: number }; gapMs: number }) => {
      const range = gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs, wordSpans)
      if (!range) {
        toast.message('Gap already short enough')
        return
      }
      onAddCut(range)
      const saved = Math.max(0, hit.gapMs - targetGapMs)
      toast.success(`Shortened pause (−${(saved / 1000).toFixed(1)} s). Undo`)
    },
    [onAddCut, targetGapMs, wordSpans],
  )

  const onSkipOne = useCallback(() => {
    if (!gapHits.length) return
    setGapCursor((c) => (c >= gapHits.length - 1 ? 0 : c + 1))
  }, [gapHits.length])

  const onShortenOne = useCallback(() => {
    const hit = gapHits[gapCursor]
    if (!hit) return
    shortenHit(hit)
    if (searchOptions.autoAdvance) setGapCursor((c) => Math.min(c, Math.max(0, gapHits.length - 2)))
  }, [gapCursor, gapHits, searchOptions.autoAdvance, shortenHit])

  const onShortenAll = useCallback(() => {
    let n = 0
    for (const hit of gapHits) {
      const range = gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs, wordSpans)
      if (range) {
        onAddCut(range)
        n += 1
      }
    }
    if (n) toast.success(`Shortened ${n} pause(s). Undo`)
    onOpenChange(false)
  }, [gapHits, onAddCut, onOpenChange, targetGapMs, wordSpans])

  if (!open) return null

  return (
    <ScriptFillerReviewBar
      variant="clip"
      mode="gap"
      searchMode="gaps"
      onSearchModeChange={() => {}}
      onSkipOne={onSkipOne}
      searchQuery=""
      onSearchQueryChange={() => {}}
      searchOptions={searchOptions}
      onSearchOptionsChange={(patch) => setSearchOptions((o) => ({ ...o, ...patch }))}
      total={gapHits.length}
      cursor={gapCursor}
      filter="all"
      action="delete"
      onActionChange={() => {}}
      onFilterChange={() => {}}
      selectionOnly={false}
      onSelectionOnlyChange={() => {}}
      avoidHarshCuts={false}
      onAvoidHarshCutsChange={() => {}}
      targetGapSec={targetGapSec}
      onTargetGapSecChange={onTargetGapSecChange}
      onPrev={() => setGapCursor((c) => (c <= 0 ? gapHits.length - 1 : c - 1))}
      onNext={() => setGapCursor((c) => (c >= gapHits.length - 1 ? 0 : c + 1))}
      onRemoveOne={onShortenOne}
      onRemoveAll={onShortenAll}
      onClose={() => onOpenChange(false)}
    />
  )
}
