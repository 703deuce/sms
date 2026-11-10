import { youtubeRunEvent } from '@/lib/youtube-video/step-log'
import type { YtCheckpoint, YtStep } from '@/lib/youtube-video/pipeline/yt-types'

/** Only finite counts, source indices, stage identifiers and error codes are logged.
 * Never send ASR text, model arguments, signed URLs or upload storage keys. */
export function ytLog(
  runId: string, checkpoint: YtCheckpoint, stage: string, event: string,
  fields: Partial<Pick<YtStep, 'sourceIndex' | 'windowIndex' | 'count' | 'accepted' | 'rejected' | 'code'>> = {},
): void {
  const step: YtStep = { at: new Date().toISOString(), stage, event }
  for (const key of ['sourceIndex','windowIndex','count','accepted','rejected'] as const) {
    const value = fields[key]
    if (typeof value === 'number' && Number.isSafeInteger(value)) step[key] = value
  }
  if (typeof fields.code === 'string' && /^[a-z0-9_:-]{1,90}$/i.test(fields.code)) step.code = fields.code
  checkpoint.steps.push(step)
  // Existing YouTube console helper emits safe structured metadata.
  youtubeRunEvent(runId, stage, event, {
    sourceCount: step.sourceIndex,
    wordCount: step.count,
    optionCount: step.accepted,
    reason: step.code,
  })
}

export function ytErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : 'unknown_error'
  // Our own validator codes are machine-readable; arbitrary API/LLM messages
  // may contain request bodies, signed URLs or transcript words and are never logged.
  return /^[a-z0-9_:-]{1,90}$/i.test(message) ? message : 'external_or_model_error'
}
