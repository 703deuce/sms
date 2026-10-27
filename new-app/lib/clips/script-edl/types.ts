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
}
