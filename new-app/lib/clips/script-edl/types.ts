import type { BrollItem } from '@/lib/clips/broll'
import type { ClipEditsAudio } from '@/lib/clips/audio'

export type EdlSourceSegment = {
  kind: 'source'
  srcInMs: number
  srcOutMs: number
  outInMs: number
  outOutMs: number
}

export type EdlGapSegment = {
  kind: 'gap'
  durMs: number
  freezeSrcMs: number
  outInMs: number
}

export type EdlSegment = EdlSourceSegment | EdlGapSegment

export type ScriptAspect = '9:16' | '1:1' | '4:5' | '16:9'

export type ScriptReframeMode = 'speaker_follow' | 'center_crop' | 'manual'

/** Manual reframe crop in source-normalized percent (0–100). */
export type ReframeCropRect = { cx: number; cy: number; w: number; h: number }

export type ReframeKeyframe = { srcMs: number; crop: ReframeCropRect }

/** Composition preview / export prefs (M4 — maps to clip edits at export). */
export type ScriptEditorSettings = {
  aspect?: ScriptAspect
  reframeMode?: ScriptReframeMode
  captionsEnabled?: boolean
  /** Show struck / cut words in script + source timeline ghosts (Descript-style). */
  showDeletedWords?: boolean
  volumePct?: number
  captions?: {
    enabled?: boolean
    presetId?: string
    animation?: string
    size?: number
    position?: string
    case?: string
    wordsPerLine?: number
    colors?: { a?: string; b?: string }
    keywordHighlight?: boolean
    emphasis?: number[]
  }
}

/** v1 document: ordered kept word ids + explicit gap inserts (M2 expands token model). */
export type ScriptDocumentV1 = {
  v: 1
  keptWordIds: string[]
  deletedWordIds: string[]
  /** Immutable transcript order for restore / display. */
  wordOrder?: string[]
  gapInserts?: { afterWordId?: string; atOutMs?: number; durMs: number }[]
  /** Edit boundaries at output ms (split tool); duration unchanged. */
  splitAtOutMs?: number[]
  /** Per-word pad before token in output (wordbar boundary fix). */
  padBeforeMs?: Record<string, number>
  /** M7+ — scene metadata (output ms filled when scenes ship). */
  scenes?: { id: string; startWordId?: string; label?: string; outStartMs?: number; layoutId?: string }[]
  /** M8+ — markers in output time. */
  markers?: { id: string; outMs: number; label?: string; exportAsChapter?: boolean }[]
  /** M9+ — word-anchored overlays; outStartMs optional until anchored via EDL. */
  overlays?: {
    id: string
    anchorWordId: string
    mediaAssetId: string
    durMs: number
    layer?: number
    label?: string
    outStartMs?: number
  }[]
  /** M10+ — music clips on output timeline. */
  musicTracks?: { id: string; assetId: string; outStartMs: number; durMs: number; label?: string; duckUnderSpeech?: boolean }[]
  /** Clipper-compatible B-roll (worker `load_broll_specs`). */
  broll?: BrollItem[]
  /** Clipper-compatible audio (worker `load_audio_assets`). */
  audio?: ClipEditsAudio
  /** M4 — canvas pills + side panels (aspect, captions, volume). */
  settings?: ScriptEditorSettings
  /** M4 — playback skipped, struck-through in script (spec §B2 ignore). */
  ignoredWordIds?: string[]
  /** M4 — audio kept, hidden in script + captions (filler “transcript only”). */
  transcriptHiddenWordIds?: string[]
  /** M4 — symmetric silence trim around gaps (head/tail per word, source ms). */
  wordSourceAdjust?: Record<string, { headTrimMs?: number; tailTrimMs?: number }>
  /** M4 — manual reframe keyframes in source time. */
  reframeKeyframes?: ReframeKeyframe[]
}
