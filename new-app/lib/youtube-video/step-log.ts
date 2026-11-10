import { YoutubeVideoError } from '@/lib/youtube-video/errors'

type YoutubeRunStepFields = {
  projectId?: string
  sourceCount?: number
  wordCount?: number
  optionCount?: number
  status?: string
  reason?: string
  windowIndex?: number
  windowCount?: number
  issues?: string[]
}

/** Structured logs omit URLs, request bodies, transcript text and secrets. */
export function youtubeRunEvent(
  runId: string, stage: string, event: string,
  fields: YoutubeRunStepFields & { elapsedMs?: number; errorCode?: string } = {},
): void {
  console.info('[youtube-video:step]', { runId, stage, event, ...fields })
}

export async function traceYoutubeRunStep<T>(
  runId: string, stage: string,
  operation: () => Promise<T> | T,
  fields: YoutubeRunStepFields = {},
): Promise<T> {
  const started = Date.now()
  youtubeRunEvent(runId, stage, 'start', fields)
  try {
    const result = await operation()
    youtubeRunEvent(runId, stage, 'done', { ...fields, elapsedMs: Date.now() - started })
    return result
  } catch (err) {
    youtubeRunEvent(runId, stage, 'failed', {
      ...fields, elapsedMs: Date.now() - started,
      errorCode: err instanceof YoutubeVideoError ? err.code : err instanceof Error ? err.name : 'unknown',
    })
    throw err
  }
}
