import { describe, expect, it } from 'vitest'
import { resolveClipsReadyForStatus } from '@/lib/server/clips/project-clip-progress'

describe('resolveClipsReadyForStatus', () => {
  it('prefers worker-reported clipsReady', () => {
    expect(
      resolveClipsReadyForStatus({
        status: 'RENDERING',
        clipCount: 8,
        clipsWithPreview: 2,
        streamerProgress: { clipsReady: 3, clipsTotal: 8 },
      }),
    ).toEqual({ clipsReady: 3, clipsTotal: 8 })
  })

  it('counts preview rows during render, not all clip rows', () => {
    expect(
      resolveClipsReadyForStatus({
        status: 'RENDERING',
        clipCount: 8,
        clipsWithPreview: 2,
        streamerProgress: {},
      }),
    ).toEqual({ clipsReady: 2, clipsTotal: undefined })
  })

  it('falls back to clipCount when pipeline not mid-render', () => {
    expect(
      resolveClipsReadyForStatus({
        status: 'FINDING_CLIPS',
        clipCount: 5,
        clipsWithPreview: 0,
        streamerProgress: {},
      }),
    ).toEqual({ clipsReady: 5, clipsTotal: undefined })
  })
})
