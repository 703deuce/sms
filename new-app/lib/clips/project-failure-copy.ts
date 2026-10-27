import {
  CLIP_PROCESSING_FAILED_USER_MESSAGE,
  isInternalProcessingError,
} from '@/lib/clips/user-facing-job-error'

/** User-facing copy for clip project failures and soft-empty outcomes. */

export type ClipProjectFailureKind =
  | 'upload'
  | 'transcribe'
  | 'no_clips'
  | 'timeout'
  | 'processing'
  | 'ready_empty'

export type ClipProjectFailureCopy = {
  kind: ClipProjectFailureKind
  title: string
  message: string
  retryLabel: string
}

function norm(s: string | null | undefined) {
  return (s ?? '').toLowerCase()
}

function userSafeError(error: string | null | undefined): string | null {
  if (!error?.trim()) return null
  if (isInternalProcessingError(error)) return CLIP_PROCESSING_FAILED_USER_MESSAGE
  return error.trim()
}

export function describeClipProjectFailure(input: {
  status: string
  error?: string | null
  stage?: string | null
  clipCount?: number
}): ClipProjectFailureCopy | null {
  const { status, stage, clipCount = 0 } = input
  const safeError = userSafeError(input.error)
  const err = norm(safeError)
  const stg = norm(stage)

  if (status === 'READY' && clipCount === 0) {
    if (err.includes('no complete') || err.includes('no moments') || err.includes('no clips')) {
      return {
        kind: 'no_clips',
        title: 'No clips found',
        message:
          safeError ||
          'We could not find complete, self-contained moments in this segment. Try a longer clip, different range, or Talking mode.',
        retryLabel: 'Adjust and retry',
      }
    }
    if (safeError) {
      return {
        kind: 'ready_empty',
        title: 'No clips to show',
        message: safeError,
        retryLabel: 'Retry processing',
      }
    }
    return {
      kind: 'ready_empty',
      title: 'No clips to show',
      message:
        'Processing finished but no clips were saved. Try a longer segment, Talking mode, or retry processing.',
      retryLabel: 'Retry processing',
    }
  }

  if (status !== 'FAILED' && status !== 'CANCELED') {
    if (err.includes('stalled') || err.includes('retry processing')) {
      return {
        kind: 'timeout',
        title: 'Processing timed out',
        message: safeError || 'Processing stopped before finishing. Retry to resume from the last completed step.',
        retryLabel: 'Retry processing',
      }
    }
    return null
  }

  if (err.includes('upload') || err.includes('multipart') || stg.includes('upload')) {
    return {
      kind: 'upload',
      title: 'Upload failed',
      message:
        safeError ||
        'Your video could not be uploaded completely. Check your connection and try uploading again.',
      retryLabel: 'Upload again',
    }
  }

  if (
    err.includes('transcri') ||
    err.includes('asr') ||
    err.includes('deepgram') ||
    err.includes('whisper') ||
    stg.includes('transcrib')
  ) {
    return {
      kind: 'transcribe',
      title: 'Transcription failed',
      message:
        safeError ||
        'We could not transcribe this video. Retry processing or upload a file with clearer speech.',
      retryLabel: 'Retry processing',
    }
  }

  if (err.includes('stalled') || err.includes('timeout') || err.includes('timed out')) {
    return {
      kind: 'timeout',
      title: 'Processing timed out',
      message:
        safeError ||
        'The worker stopped responding before your project finished. Retry processing to continue.',
      retryLabel: 'Retry processing',
    }
  }

  if (err.includes('no complete') || err.includes('no moments') || err.includes('no clips')) {
    return {
      kind: 'no_clips',
      title: 'No clips found',
      message: safeError || 'No suitable moments were found in this video.',
      retryLabel: 'Retry processing',
    }
  }

  return {
    kind: 'processing',
    title: 'Processing failed',
    message: safeError || CLIP_PROCESSING_FAILED_USER_MESSAGE,
    retryLabel: 'Retry processing',
  }
}
