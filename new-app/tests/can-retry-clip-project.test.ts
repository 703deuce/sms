import { describe, expect, it } from 'vitest'
import { canRetryClipProject } from '@/lib/server/clips/can-retry-clip-project'

describe('canRetryClipProject', () => {
  it('allows retry for READY with zero clips and no-moments error', () => {
    expect(
      canRetryClipProject({
        status: 'READY',
        clipCount: 0,
        error: 'No complete, self-contained moments found in this segment.',
      }),
    ).toBe(true)
  })

  it('blocks retry for READY with clips', () => {
    expect(
      canRetryClipProject({
        status: 'READY',
        clipCount: 2,
        error: 'No complete, self-contained moments found in this segment.',
      }),
    ).toBe(false)
  })

  it('allows FAILED regardless of clip count', () => {
    expect(canRetryClipProject({ status: 'FAILED', clipCount: 0 })).toBe(true)
  })
})
