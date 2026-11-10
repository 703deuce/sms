import type {AiProducerSourceRef} from '@/lib/ai-producer-agent/types'

/** Shared instruction for a unified (Story + continuous) clip run. */
export const UNIFIED_CLIP_INSTRUCTION =
  'Find both stitched story clips and continuous 15-30 second moments from the same source. Prefer complete multi-beat stories; use continuous clips to fill in distinct moments.'

export type UnifiedClipRunSource = {
  sourceId: string
  kind: 'upload' | 'stream' | 'clip'
  projectId: string
  rangeMs: [number, number]
  durationMs?: number
  title?: string
  clipId?: string
  storageKey?: string
}

export type UnifiedClipRunRequest = {
  source: UnifiedClipRunSource
  targetLengthS?: [number, number]
  instruction?: string
  exportOnFinish?: boolean
  platform?: 'tiktok' | 'shorts' | 'reels'
}

export type UnifiedClipRunCreateInput = {
  sources: AiProducerSourceRef[]
  outputType: 'story'
  storyMode: 'clip_unified_v1'
  targetLengthS: [number, number]
  visualEvidenceMode: 'visual_audio'
  exportOnFinish: boolean
  instruction: string
  platform?: 'tiktok' | 'shorts' | 'reels'
}

/** Map the upload/stream length preset to a Story target preference. */
export function storyTargetFromAgentSeconds(seconds: number): [number, number] {
  const value = seconds === 30 || seconds === 90 ? seconds : 60
  return [Math.max(15, value - 10), Math.min(105, value + 10)]
}

/**
 * Request shape for one unified clip job. Upload and stream both use this
 * so stream clipping can call the same entry point later.
 */
export function buildUnifiedClipRunInput(opts: UnifiedClipRunRequest): UnifiedClipRunCreateInput {
  const range = opts.source.rangeMs
  const [minS, maxS] = opts.targetLengthS ?? [30, 60]
  const lo = Math.max(15, minS)
  const hi = Math.min(105, Math.max(lo, maxS))
  return {
    sources: [{
      sourceId: opts.source.sourceId,
      kind: opts.source.kind,
      projectId: opts.source.projectId,
      rangeMs: range,
      durationMs: opts.source.durationMs ?? Math.max(0, range[1] - range[0]),
      title: opts.source.title,
      clipId: opts.source.clipId,
      storageKey: opts.source.storageKey,
    }],
    outputType: 'story',
    storyMode: 'clip_unified_v1',
    targetLengthS: [lo, hi],
    visualEvidenceMode: 'visual_audio',
    exportOnFinish: opts.exportOnFinish !== false,
    instruction: opts.instruction?.trim() || UNIFIED_CLIP_INSTRUCTION,
    ...(opts.platform ? {platform: opts.platform} : {}),
  }
}
