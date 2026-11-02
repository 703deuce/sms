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
const getClipStorageForObjectKey = vi.fn(async (_key: string, driver: string | null) => ({
  getJson: vi.fn().mockResolvedValue([{ w: 'hi', s: 1, e: 2 }]),
  driver,
}))

vi.mock('@/lib/storage', () => ({
  getClipStorageForObjectKey: (...args: unknown[]) => getClipStorageForObjectKey(...args),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { create: createMock },
    clipProject: { findFirst: projectFindFirst },
  }),
}))

import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { deriveClipFromSelection } from '@/lib/server/clips/derive-clip'

const defaultSettings = {
  v: 2 as const,
  mode: 'auto' as const,
  genre: 'auto' as const,
  clipLength: 'auto' as const,
  clipLenMode: 'auto' as const,
  targetClipLenS: null,
  rangeStartMs: 0,
  rangeEndMs: 0,
  layout: 'speaker_follow' as const,
  aspectRatio: '9:16' as const,
  autoZoom: false,
}

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
      upload: null,
      settings: defaultSettings,
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

  it('loads transcript with parent storageDriver (ClipProject has no storageDriver field)', async () => {
    vi.mocked(getClipForWorkspace).mockResolvedValue({
      id: 'clip_parent',
      workspaceId: 'ws_1',
      projectId: 'proj_1',
      title: 'Parent',
      startMs: 0,
      endMs: 10_000,
      storageDriver: 'b2',
      edits: {},
      scores: {},
      score: 1,
    } as never)
    createMock.mockResolvedValue({ id: 'clip_child' })
    projectFindFirst.mockResolvedValue({
      transcriptKey: 'ws/ws_1/projects/proj_1/words.json',
      transcriptWords: null,
      upload: { storageDriver: 's3' },
      settings: defaultSettings,
    })

    await deriveClipFromSelection('ws_1', 'clip_parent', { trimIn: 1000, trimOut: 5000 })
    expect(projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({ storageDriver: expect.anything() }),
      }),
    )
    expect(getClipStorageForObjectKey).toHaveBeenCalledWith(
      'ws/ws_1/projects/proj_1/words.json',
      'b2',
    )
  })
})
