'use client'

import { ScriptShortenGapsPanel } from '@/components/script-editor/side/script-shorten-gaps-panel'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { maxPlausibleGapMsForTrim, sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'
import { editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { gapShortenCutRange, listClipGapHits, shortenAllClipGaps } from '@/lib/clips/gap-shorten'
import type { GapFilterMode, GapHit } from '@/lib/clips/script-editor/gap-hits'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

export type ClipGapToolSettings = {
  mode: GapFilterMode
  minGapSec: number
  maxGapSec: number
  targetGapSec: number
}

export function ClipShortenGapsPanel({
  clipId,
  words,
  edits,
  clipStartMs,
  clipEndMs,
  settings,
  onSettingsChange,
  onAddCut,
  onSetCutRanges,
  onSeek,
  onOpenReview,
}: {
  clipId: string
  words: SourceWord[]
  edits: ClipEditsV2
  clipStartMs: number
  clipEndMs: number
  settings: ClipGapToolSettings
  onSettingsChange: (patch: Partial<ClipGapToolSettings>) => void
  onAddCut: (range: [number, number]) => void
  onSetCutRanges?: (ranges: [number, number][]) => void
  onSeek: (sourceMs: number) => void
  onOpenReview: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [activeHitId, setActiveHitId] = useState<string | null>(null)

  const clipBounds = useMemo(() => ({ clipStartMs, clipEndMs }), [clipStartMs, clipEndMs])
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
  const targetGapMs = Math.round(settings.targetGapSec * 1000)

  const gapHits = useMemo(
    () =>
      listClipGapHits(orderedWords, cutRanges, {
        mode: settings.mode,
        minGapMs: Math.round(settings.minGapSec * 1000),
        maxGapMs: settings.mode === 'between' ? Math.round(settings.maxGapSec * 1000) : undefined,
        targetGapMs,
        maxPlausibleGapMs,
      }),
    [orderedWords, cutRanges, settings, targetGapMs, maxPlausibleGapMs],
  )

  const activeHit = gapHits[cursor] ?? gapHits.find((h) => h.word.id === activeHitId) ?? null

  const shortenHit = (hit: GapHit) => {
    const range = gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs, wordSpans)
    if (!range) {
      toast.message('Gap already short enough')
      return
    }
    onAddCut(range)
    toast.success(`Shortened pause (−${((hit.gapMs - targetGapMs) / 1000).toFixed(1)} s). Undo`)
  }

  return (
    <ScriptShortenGapsPanel
      gapHits={gapHits}
      mode={settings.mode}
      onModeChange={(m) => onSettingsChange({ mode: m })}
      minGapSec={settings.minGapSec}
      maxGapSec={settings.maxGapSec}
      onMinGapSecChange={(n) => onSettingsChange({ minGapSec: n })}
      onMaxGapSecChange={(n) => onSettingsChange({ maxGapSec: n })}
      targetGapSec={settings.targetGapSec}
      onTargetGapSecChange={(n) => onSettingsChange({ targetGapSec: n })}
      activeHitId={activeHit?.word.id ?? null}
      rangeStartMs={clipStartMs}
      onSelectHit={(hit) => {
        setActiveHitId(hit.word.id)
        const idx = gapHits.findIndex((h) => h.word.id === hit.word.id)
        setCursor(idx >= 0 ? idx : 0)
        const mid = hit.prevWord.t1Ms + hit.gapMs / 2
        onSeek(Math.round(mid))
      }}
      onShortenOne={() => {
        const hit = gapHits[cursor]
        if (!hit) return
        shortenHit(hit)
        setCursor((c) => Math.min(c, Math.max(0, gapHits.length - 2)))
      }}
      onShortenAll={() => {
        const { cutRanges: next, count } = shortenAllClipGaps(orderedWords, cutRanges, {
          mode: settings.mode,
          minGapMs: Math.round(settings.minGapSec * 1000),
          maxGapMs: settings.mode === 'between' ? Math.round(settings.maxGapSec * 1000) : undefined,
          targetGapMs,
          maxPlausibleGapMs,
          wordSpans,
        })
        if (!count) {
          toast.message('No pauses match these settings')
          return
        }
        if (onSetCutRanges) onSetCutRanges(next)
        else {
          for (const r of next) {
            if (!cutRanges.some(([a, b]) => a === r[0] && b === r[1])) onAddCut(r)
          }
        }
        const remaining = listClipGapHits(orderedWords, next, {
          mode: settings.mode,
          minGapMs: Math.round(settings.minGapSec * 1000),
          maxGapMs: settings.mode === 'between' ? Math.round(settings.maxGapSec * 1000) : undefined,
          targetGapMs,
          maxPlausibleGapMs,
        }).length
        toast.success(
          remaining === 0
            ? `Shortened ${count} pause(s). All matching gaps cleared. Undo`
            : `Shortened ${count} pause(s). Undo`,
        )
      }}
      onOpenReview={onOpenReview}
    />
  )
}
