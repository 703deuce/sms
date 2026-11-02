import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/server/clips/clips', () => ({
  getClipForWorkspace: vi.fn(),
}))

vi.mock('@/lib/server/clips/clip-patch-bounds', () => ({
  clipBoundsForPatch: vi.fn(async (clip: { startMs: number; endMs: number }) => ({
    clipStartMs: clip.startMs,
    clipEndMs: clip.endMs,
  })),
}))

const createMock = vi.fn()
const projectFindFirst = vi.fn()
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { create: createMock },
    clipProject: { findFirst: projectFindFirst },
  }),
}))

import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { deriveClipFromSelection } from '@/lib/server/clips/derive-clip'

describe('deriveClipFromSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a child clip for valid trim', async () => {
    vi.mocked(getClipForWorkspace).mockResolvedValue({
      id: 'clip_parent',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Parent',
      startMs: 0,
      endMs: 10_000,
      edits: {},
      scores: {},
      score: 1,
    } as never)
    createMock.mockResolvedValue({ id: 'clip_child' })
    projectFindFirst.mockResolvedValue({
      transcriptKey: null,
      transcriptWords: null,
      settings: {
        v: 2,
        mode: 'auto',
        genre: 'auto',
        clipLength: 'auto',
        clipLenMode: 'auto',
        targetClipLenS: null,
        rangeStartMs: 0,
        rangeEndMs: 0,
        layout: 'speaker_follow',
        aspectRatio: '9:16',
        autoZoom: false,
      },
    })

    const result = await deriveClipFromSelection('ws_1', 'clip_parent', {
      trimIn: 1000,
      trimOut: 5000,
      title: 'Child',
    })
    expect(result?.clipId).toBeTruthy()
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('rejects too-short trim', async () => {
    vi.mocked(getClipForWorkspace).mockResolvedValue({
      id: 'clip_parent',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Parent',
      startMs: 0,
      endMs: 10_000,
      edits: {},
      scores: {},
      score: 1,
    } as never)
    await expect(
      deriveClipFromSelection('ws_1', 'clip_parent', { trimIn: 1000, trimOut: 1200 }),
    ).rejects.toThrow(/too short/)
  })
})
