'use client'

import { ScriptShortenGapsPanel } from '@/components/script-editor/side/script-shorten-gaps-panel'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import type { SourceWord } from '@/lib/clips/source-words'
import { wordSourceMs } from '@/lib/clips/source-words'
import { editorWordsForClipFillerReview } from '@/lib/clips/editor/filler-review-words'
import { gapShortenCutRange, listClipGapHits } from '@/lib/clips/gap-shorten'
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
  settings,
  onSettingsChange,
  onAddCut,
  onSeek,
  onOpenReview,
}: {
  clipId: string
  words: SourceWord[]
  edits: ClipEditsV2
  clipStartMs: number
  settings: ClipGapToolSettings
  onSettingsChange: (patch: Partial<ClipGapToolSettings>) => void
  onAddCut: (range: [number, number]) => void
  onSeek: (sourceMs: number) => void
  onOpenReview: () => void
}) {
  const [cursor, setCursor] = useState(0)
  const [activeHitId, setActiveHitId] = useState<string | null>(null)

  const orderedWords = useMemo(() => editorWordsForClipFillerReview(clipId, words), [clipId, words])
  const cutRanges = edits.cutRanges ?? []
  const wordSpans = useMemo(
    () =>
      words.map((w) => {
        const { startMs, endMs } = wordSourceMs(w)
        return { s: startMs / 1000, e: endMs / 1000 }
      }),
    [words],
  )
  const targetGapMs = Math.round(settings.targetGapSec * 1000)

  const gapHits = useMemo(
    () =>
      listClipGapHits(orderedWords, cutRanges, {
        mode: settings.mode,
        minGapMs: Math.round(settings.minGapSec * 1000),
        maxGapMs: settings.mode === 'between' ? Math.round(settings.maxGapSec * 1000) : undefined,
        targetGapMs,
      }),
    [orderedWords, cutRanges, settings, targetGapMs],
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
        let n = 0
        for (const hit of gapHits) {
          const range = gapShortenCutRange(hit.prevWord.t1Ms, hit.word.t0Ms, hit.gapMs, targetGapMs, wordSpans)
          if (range) {
            onAddCut(range)
            n += 1
          }
        }
        if (n) toast.success(`Shortened ${n} pause(s). Undo`)
      }}
      onOpenReview={onOpenReview}
    />
  )
}
