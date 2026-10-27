'use client'

import { useMemo } from 'react'
import { CaptionOverlay } from '@/components/clips/editor/caption-overlay'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptEditorSettings } from '@/lib/clips/script-edl/types'
import { resolveScriptSettings } from '@/lib/clips/script-editor/default-settings'

export function ScriptCaptionOverlay({
  keptWords,
  rangeStartMs,
  currentTimeSec,
  settings,
  boxHeightPx,
  outputDurationSec,
}: {
  keptWords: EditorWord[]
  rangeStartMs: number
  currentTimeSec: number
  settings: ScriptEditorSettings
  boxHeightPx: number
  outputDurationSec: number
}) {
  const resolved = resolveScriptSettings(settings)
  if (resolved.captionsEnabled === false) return null

  const clipWords: ClipWord[] = useMemo(
    () =>
      keptWords.map((w, i) => ({
        w: w.text,
        s: (w.t0Ms - rangeStartMs) / 1000,
        e: (w.t1Ms - rangeStartMs) / 1000,
        i: w.index ?? i,
        p: w.conf,
        spk: Number.parseInt(w.speakerId.replace('spk:', ''), 10) || 0,
      })),
    [keptWords, rangeStartMs],
  )

  const cap = resolved.captions ?? {}
  const edits: ClipEditsV2 = {
    v: 2,
    trim: { in: 0, out: outputDurationSec * 1000 },
    cutRanges: [],
    wordFixes: {},
    captions: { ...cap, enabled: true },
    layout: { mode: 'speaker_follow', shotOverrides: [] },
  }

  return (
    <CaptionOverlay
      words={clipWords}
      currentTimeSec={currentTimeSec - rangeStartMs / 1000}
      edits={edits}
      boxHeightPx={boxHeightPx}
      outputDurationSec={outputDurationSec}
    />
  )
}
