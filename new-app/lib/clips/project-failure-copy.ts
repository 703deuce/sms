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

export function describeClipProjectFailure(input: {
  status: string
  error?: string | null
  stage?: string | null
  clipCount?: number
}): ClipProjectFailureCopy | null {
  const { status, error, stage, clipCount = 0 } = input
  const err = norm(error)
  const stg = norm(stage)

  if (status === 'READY' && clipCount === 0) {
    if (err.includes('no complete') || err.includes('no moments') || err.includes('no clips')) {
      return {
        kind: 'no_clips',
        title: 'No clips found',
        message:
          error?.trim() ||
          'We could not find complete, self-contained moments in this segment. Try a longer clip, different range, or Talking mode.',
        retryLabel: 'Adjust and retry',
      }
    }
    if (error?.trim()) {
      return {
        kind: 'ready_empty',
        title: 'No clips to show',
        message: error.trim(),
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
        message: error?.trim() || 'Processing stopped before finishing. Retry to resume from the last completed step.',
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
        error?.trim() ||
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
        error?.trim() ||
        'We could not transcribe this video. Retry processing or upload a file with clearer speech.',
      retryLabel: 'Retry processing',
    }
  }

  if (err.includes('stalled') || err.includes('timeout') || err.includes('timed out')) {
    return {
      kind: 'timeout',
      title: 'Processing timed out',
      message:
        error?.trim() ||
        'The worker stopped responding before your project finished. Retry processing to continue.',
      retryLabel: 'Retry processing',
    }
  }

  if (err.includes('no complete') || err.includes('no moments') || err.includes('no clips')) {
    return {
      kind: 'no_clips',
      title: 'No clips found',
      message: error?.trim() || 'No suitable moments were found in this video.',
      retryLabel: 'Retry processing',
    }
  }

  return {
    kind: 'processing',
    title: 'Processing failed',
    message: error?.trim() || 'Something went wrong while processing this project.',
    retryLabel: 'Retry processing',
  }
}
