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
}

export type EdlSegment = EdlSourceSegment | EdlGapSegment

/** v1 document: ordered kept word ids + explicit gap inserts (M2 expands token model). */
export type ScriptDocumentV1 = {
  v: 1
  keptWordIds: string[]
  deletedWordIds: string[]
  /** Immutable transcript order for restore / display. */
  wordOrder?: string[]
  gapInserts?: { afterWordId: string; durMs: number }[]
}
