import { youtubeRunEvent } from '@/lib/youtube-video/step-log'
import type { YtCheckpoint, YtStep } from '@/lib/youtube-video/pipeline/yt-types'

/** Only finite counts, source indices, stage identifiers and error codes are logged.
 * Never send ASR text, model arguments, signed URLs or upload storage keys. */
export function ytLog(
  runId: string, checkpoint: YtCheckpoint, stage: string, event: string,
  fields: Partial<Pick<YtStep, 'sourceIndex' | 'windowIndex' | 'windowCount' | 'count' | 'accepted' | 'rejected' | 'code' | 'issues'>> = {},
): void {
  const step: YtStep = { at: new Date().toISOString(), stage, event }
  for (const key of ['sourceIndex','windowIndex','windowCount','count','accepted','rejected'] as const) {
    const value = fields[key]
    if (typeof value === 'number' && Number.isSafeInteger(value)) step[key] = value
  }
  if (typeof fields.code === 'string' && /^[a-z0-9_:-]{1,90}$/i.test(fields.code)) step.code = fields.code
  if(Array.isArray(fields.issues)){
    // Model prose can contain transcript words or signed URLs: only log issue categories.
    step.issues=fields.issues.slice(0,12).map(issue=>{
      const value=issue.toLowerCase()
      if(/ground|source|fabricat|word/.test(value))return 'grounding'
      if(/visual|frame|screen|shot/.test(value))return 'visual_evidence'
      if(/join|transit|continu|cut/.test(value))return 'continuity'
      if(/end|payoff|closur/.test(value))return 'ending'
      if(/open|intro|context/.test(value))return 'opening'
      return 'editorial_review'
    })
  }
  checkpoint.steps.push(step)
  // Existing YouTube console helper emits safe structured metadata.
  youtubeRunEvent(runId, stage, event, {
    sourceCount: step.sourceIndex,
    wordCount: step.count,
    optionCount: step.accepted,
    reason: step.code,
    windowIndex: step.windowIndex,
    windowCount: step.windowCount,
    issues: step.issues,
  })
}

export function ytErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error'
  // Our own validator codes are machine-readable; arbitrary API/LLM messages
  // may contain request bodies, signed URLs or transcript words and are never logged.
  return /^[a-z0-9_:-]{1,90}$/i.test(message) ? message : 'external_or_model_error'
}
