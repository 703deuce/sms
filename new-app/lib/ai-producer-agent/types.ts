export type AiProducerSourceRef = {
  sourceId: string
  kind: 'stream' | 'upload' | 'clip'
  projectId?: string
  clipId?: string
  storageKey?: string
  rangeMs?: [number, number]
  durationMs?: number
  title?: string
}

export type AiProducerRunConfig = {
  targetLengthS: [number, number]
  music: 'none' | 'library'
  memeSfx: 'off' | 'subtle' | 'meme'
  exportOnFinish: boolean
  geminiUsdCap: number
}

export type EditPlanSegment = {
  id: string
  sourceId: string
  srcInMs: number
  srcOutMs: number
  beat?: string
  rules?: string[]
}

export type EditPlanJson = {
  genre: string
  outputType: 'single_payoff' | 'montage'
  platform: string
  targetLengthS: [number, number]
  story: string
  segments: EditPlanSegment[]
  cutsInside?: Array<{ segmentId: string; removeSrcMs: [number, number]; reason?: string; rules?: string[] }>
  transitions?: Array<{ atSegment: string; type: string }>
  splitEdits?: Array<{ atSegment: string; audioLeadMs: number }>
  layout?: Record<string, unknown>
  zooms?: Array<Record<string, unknown>>
  captions?: Record<string, unknown>
  text?: Array<Record<string, unknown>>
  music?: unknown
  sfx?: unknown[]
  speed?: unknown[]
  selfReviewExpectations?: string[]
}
