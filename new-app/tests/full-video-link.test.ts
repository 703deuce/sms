import { beforeEach, describe, expect, it, vi } from 'vitest'

const { sourceQuery, createProject } = vi.hoisted(() => ({
  sourceQuery: vi.fn(),
  createProject: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ $queryRaw: sourceQuery }),
  withPrismaPoolRetry: async (_operation: string, execute: () => Promise<unknown>) => execute(),
}))

vi.mock('@/lib/server/clips/ensure-full-video-project', () => ({
  createFullVideoProjectForUpload: (...args: unknown[]) => createProject(...args),
}))

const existingSource = {
  sourceProjectId: 'proj_clips',
  sourceProjectTitle: 'Found clips',
  sourceSettings: { fromFullVideoProjectId: 'proj_fv_existing' },
  sourceProxyKey: null,
  sourceRangeEndMs: 60_000,
  transcriptWords: null,
  sourceMs: 5000,
  endMs: 9000,
  clipTitle: 'Test clip',
  uploadId: 'up_1',
  durationMs: 60_000,
  width: 1920,
  height: 1080,
  filename: 'talk.mp4',
  existingProjectId: 'proj_fv_existing',
  existingClipId: 'clip_fv_existing',
  dbStatementMs: 8,
}

describe('resolveFullVideoLink fast-path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sourceQuery.mockResolvedValue([existingSource])
    createProject.mockResolvedValue({ projectId: 'proj_fv_up_1', clipId: 'clip_fv_up_1' })
  })

  it('returns a linked full-video editor URL in one workspace-scoped query', async () => {
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')

    expect(link).toMatchObject({
      projectId: 'proj_fv_existing',
      clipId: 'clip_fv_existing',
      sourceMs: 5000,
    })
    expect(link && 'url' in link ? link.url : '').toContain('t=5000')
    expect(link && 'url' in link ? link.url : '').toContain('fromClip=clip_a')
    expect(sourceQuery).toHaveBeenCalledTimes(1)
    const sql = (sourceQuery.mock.calls[0]?.[0] as TemplateStringsArray).join('?')
    expect(sql).toContain('JOIN clip_uploads')
    expect(sql).toContain('LEFT JOIN LATERAL')
    expect(sql).toContain('c."workspaceId"')
    expect(sql).toContain('fp."workspaceId"')
    expect(createProject).not.toHaveBeenCalled()
  })

  it('opens the seeded clip immediately on first click and copies transcript words', async () => {
    const words = [{ w: 'hi', s: 0, e: 1, i: 0 }]
    sourceQuery.mockResolvedValue([{
      ...existingSource,
      sourceSettings: {},
      transcriptWords: words,
      existingProjectId: null,
      existingClipId: null,
    }])
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')

    expect(link).toMatchObject({
      projectId: 'proj_fv_up_1',
      clipId: 'clip_fv_up_1',
    })
    expect(link && 'url' in link ? link.url : '').toContain('/edit/clip_fv_up_1')
    expect(createProject).toHaveBeenCalledTimes(1)
    expect(createProject).toHaveBeenCalledWith(
      'ws',
      expect.objectContaining({ id: 'up_1', durationMs: 60_000 }),
      expect.objectContaining({ id: 'proj_clips', transcriptWords: words }),
    )
    expect(sourceQuery).toHaveBeenCalledTimes(1)
  })

  it('preserves the preparing response when source duration is unknown and no clip exists', async () => {
    sourceQuery.mockResolvedValue([{
      ...existingSource,
      sourceSettings: {},
      existingProjectId: null,
      existingClipId: null,
      durationMs: null,
    }])
    createProject.mockResolvedValue({ projectId: 'proj_fv_up_1', clipId: null })
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')

    expect(link).toEqual({
      preparing: true,
      stage: 'clip',
      message: 'Preparing full video editor (rendering clip)…',
      projectId: 'proj_fv_up_1',
    })
  })

  it('resolves an already-full source project to its real full clip without creating another project', async () => {
    sourceQuery.mockResolvedValue([{
      ...existingSource,
      sourceProjectId: 'proj_full_self',
      sourceSettings: { fullVideo: true },
      sourceMs: 0,
      endMs: 60_000,
      existingProjectId: 'proj_full_self',
      existingClipId: 'clip_full_root',
    }])
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_full_root')

    expect(link).toMatchObject({
      projectId: 'proj_full_self',
      clipId: 'clip_full_root',
      sourceMs: 0,
    })
    expect(link && 'url' in link ? link.url : '').toContain('/app/video-editor/proj_full_self/edit/clip_full_root')
    expect(createProject).not.toHaveBeenCalled()

    const sql = (sourceQuery.mock.calls[0]?.[0] as TemplateStringsArray).join('?')
    expect(sql).toContain("fp.settings->>'fullVideo' = 'true'")
    expect(sql).toContain('fp."workspaceId"')
  })

  it('reuses an existing project and clip without creating either one', async () => {
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const first = await resolveFullVideoLink('ws', 'clip_a')
    const second = await resolveFullVideoLink('ws', 'clip_a')
    expect(second).toEqual(first)
    expect(sourceQuery).toHaveBeenCalledTimes(2)
    expect(createProject).not.toHaveBeenCalled()
  })

  it('does not create a project when the clip or upload is unavailable', async () => {
    sourceQuery.mockResolvedValue([])
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    expect(await resolveFullVideoLink('ws', 'missing')).toBeNull()
    expect(createProject).not.toHaveBeenCalled()
  })
})
