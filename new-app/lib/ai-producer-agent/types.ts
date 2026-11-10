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

export type AiProducerOutputType = 'single_payoff' | 'montage' | 'story' | 'auto'

export type AiProducerRunConfig = {
  /** Explicitly selected experiment; absent means the locked single-source implementation. */
  storyMode?: 'single_source_v1' | 'multi_source_story_v1' | 'clean_take_v1' | 'clip_moment_v1' | 'clip_story_v1' | 'clip_unified_v1'
  editMode?: 'just_chatting_rough_cut'
  /** Story preserves one narrative; highlights curates multiple standalone moments. */
  roughCutIntent?: 'story' | 'highlights'
  /** Transcript-only A/B baseline or Gemini low-detail frames + source audio + ASR evidence. */
  visualEvidenceMode?: 'transcript_baseline' | 'visual_audio'
  /** Explicit opt-in; normal Producer and short clip callers retain existing behavior. */
  youtubeLongForm?: boolean
  targetLengthS: [number, number]
  music: 'none' | 'library'
  memeSfx: 'off' | 'subtle' | 'meme'
  exportOnFinish: boolean
  geminiUsdCap: number
  /** Set when user chose auto and the DECIDE step picked a concrete type. */
  resolvedOutputType?: 'single_payoff' | 'montage' | 'story'
  maxEditsPerRun?: number
}

export type EditPlanSegment = {
  id: string
  sourceId: string
  srcInMs: number
  srcOutMs: number
  beat?: string
  rules?: string[]
}

export type EditPlanBrokenRule = {
  ruleId: string
  reason: string
  /** Only DEFAULT or HEURISTIC may appear here; HARD must never be listed as broken. */
  severity?: 'DEFAULT' | 'HEURISTIC'
}

export type EditPlanJson = {
  genre: string
  outputType: 'single_payoff' | 'montage' | 'story'
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
  brokenRules?: EditPlanBrokenRule[]
}
