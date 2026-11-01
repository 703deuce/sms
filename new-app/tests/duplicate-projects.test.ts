import { describe, expect, it, vi, beforeEach } from 'vitest'

const createMany = vi.fn(async () => ({}))
const clipCreateMany = vi.fn(async () => ({}))
const clipFindMany = vi.fn(async () => [])
const projectCreate = vi.fn(async () => ({}))
const projectFindFirst = vi.fn(async () => null)

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findFirst: projectFindFirst, create: projectCreate },
    clip: { findMany: clipFindMany, createMany: clipCreateMany },
    $transaction: async (fn: (tx: unknown) => Promise<void>) =>
      fn({
        clipProject: { create: projectCreate },
        clip: { findMany: clipFindMany, createMany: clipCreateMany },
      }),
  }),
}))

vi.mock('@/lib/supabase/id', () => ({
  createId: vi.fn((prefix: string) => `${prefix}_new`),
}))

describe('duplicateClipProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('copies non-deleted clips with new ids and null previewKey', async () => {
    projectFindFirst.mockResolvedValueOnce({
      id: 'proj_src',
      workspaceId: 'ws1',
      createdById: 'u1',
      title: 'Demo',
      uploadId: 'up1',
      sourceUrl: null,
      settings: {},
      rangeStartMs: 0,
      rangeEndMs: 1000,
      status: 'ready',
      stage: null,
      progress: 100,
      transcriptKey: null,
      transcriptWords: null,
      proxyKey: null,
      thumbKey: null,
      folderId: null,
    })
    clipFindMany.mockResolvedValueOnce([
      {
        workspaceId: 'ws1',
        title: 'Clip A',
        reason: null,
        startMs: 0,
        endMs: 5000,
        segmentKey: null,
        score: 1,
        scores: {},
        cropKey: null,
        wordsKey: 'wk1',
        previewKey: 'prev_old',
        posterKey: null,
        storageDriver: null,
        edits: { v: 2 },
        editsSaveVersion: 2,
        aiMeta: null,
        favorite: false,
        sourceSegKey: null,
        sourceSegStartMs: null,
        sourceSegEndMs: null,
      },
    ])

    const { duplicateClipProjects } = await import('@/lib/server/clips/drive-projects')
    const ids = await duplicateClipProjects('ws1', ['proj_src'])

    expect(ids).toEqual(['proj_new'])
    expect(clipCreateMany).toHaveBeenCalledOnce()
    const data = clipCreateMany.mock.calls[0]![0].data
    expect(data).toHaveLength(1)
    expect(data[0]).toMatchObject({
      id: 'clip_new',
      projectId: 'proj_new',
      previewKey: null,
      wordsKey: 'wk1',
    })
  })

  it('skips deleted clips via findMany filter', async () => {
    projectFindFirst.mockResolvedValueOnce({
      id: 'proj_src',
      workspaceId: 'ws1',
      createdById: 'u1',
      title: 'Demo',
      uploadId: 'up1',
      sourceUrl: null,
      settings: {},
      rangeStartMs: 0,
      rangeEndMs: 1000,
      status: 'ready',
      stage: null,
      progress: 100,
      transcriptKey: null,
      transcriptWords: null,
      proxyKey: null,
      thumbKey: null,
      folderId: null,
    })
    clipFindMany.mockResolvedValueOnce([])

    const { duplicateClipProjects } = await import('@/lib/server/clips/drive-projects')
    await duplicateClipProjects('ws1', ['proj_src'])

    expect(clipFindMany).toHaveBeenCalledWith({
      where: { projectId: 'proj_src', workspaceId: 'ws1', deletedAt: null },
    })
    expect(clipCreateMany).not.toHaveBeenCalled()
  })
})
