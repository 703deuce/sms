import { describe, expect, it, vi, beforeEach } from 'vitest'

const { sourceQuery, createProject } = vi.hoisted(() => ({
  sourceQuery: vi.fn(),
  createProject: vi.fn(),
}))

vi.mock('@/lib/server/clips/ensure-full-video-project', () => ({
  createFullVideoProjectForUpload: (...args: unknown[]) => createProject(...args),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ $queryRaw: sourceQuery }),
  withPrismaPoolRetry: async (_operation: string, execute: () => Promise<unknown>) => execute(),
}))

describe('resolveFullVideoLink CL-05 moment params', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sourceQuery.mockResolvedValue([{
      sourceProjectId: 'proj_clips',
      sourceProjectTitle: 'Clips',
      sourceSettings: { fromFullVideoProjectId: 'proj_fv' },
      sourceProxyKey: null,
      sourceRangeEndMs: 60_000,
      transcriptWords: null,
      sourceMs: 5000,
      endMs: 9000,
      clipTitle: 'My moment',
      uploadId: 'up_1',
      durationMs: 60_000,
      width: 1920,
      height: 1080,
      filename: 'talk.mp4',
      existingProjectId: 'proj_fv',
      existingClipId: 'clip_fv',
      dbStatementMs: 4,
    }])
  })

  it('includes fromClip and moment range in the existing project URL', async () => {
    const { resolveFullVideoLink } = await import('@/lib/server/clips/full-video-link')
    const link = await resolveFullVideoLink('ws', 'clip_a')
    expect(link && 'url' in link ? link.url : '').toContain('fromClip=clip_a')
    expect(link && 'url' in link ? link.url : '').toContain('momentIn=5000')
    expect(link && 'url' in link ? link.url : '').toContain('momentOut=9000')
    expect(link && 'url' in link ? link.url : '').toContain('momentTitle=My%20moment')
    expect(sourceQuery).toHaveBeenCalledTimes(1)
    expect(createProject).not.toHaveBeenCalled()
  })
})
