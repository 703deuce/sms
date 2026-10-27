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
}
