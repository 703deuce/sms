import { describe, expect, it } from 'vitest'
import { describeClipProjectFailure } from '@/lib/clips/project-failure-copy'

describe('project-failure-copy', () => {
  it('maps empty ready to no clips', () => {
    const copy = describeClipProjectFailure({
      status: 'READY',
      clipCount: 0,
      error: 'No complete, self-contained moments found.',
    })
    expect(copy?.kind).toBe('no_clips')
    expect(copy?.retryLabel).toContain('retry')
  })

  it('maps transcribe errors', () => {
    const copy = describeClipProjectFailure({
      status: 'FAILED',
      error: 'Deepgram transcribe failed: timeout',
    })
    expect(copy?.kind).toBe('transcribe')
  })
})
