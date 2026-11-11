import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultClipSettings } from '@/lib/clips/settings'
import { resolveViewOnFullVideoUrl } from '@/lib/server/clips/view-on-full-video'

const { projectFindFirst, clipFindFirst } = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  clipFindFirst: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findFirst: projectFindFirst },
    clip: { findFirst: clipFindFirst },
  }),
}))

describe('resolveViewOnFullVideoUrl Batch 1', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves the linked full project and its owned full clip without reusing the short clip id', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 'proj_full' })
    clipFindFirst.mockResolvedValueOnce({ id: 'clip_full_root' })

    const url = await resolveViewOnFullVideoUrl(
      'ws_1',
      'proj_short',
      defaultClipSettings({ fromFullVideoProjectId: 'proj_full' }),
      'upload_1',
      new Date('2026-11-01T00:00:00Z'),
    )

    expect(url).toBe('/app/video-editor/proj_full/edit/clip_full_root?highlights=1')
    expect(projectFindFirst).toHaveBeenCalledWith({
      where: { id: 'proj_full', workspaceId: 'ws_1', deletedAt: null },
      select: { id: true },
    })
    expect(clipFindFirst).toHaveBeenCalledWith({
      where: { projectId: 'proj_full', workspaceId: 'ws_1', deletedAt: null },
      orderBy: { startMs: 'asc' },
      select: { id: true },
    })
  })

  it('treats an already-full project as itself instead of rediscovering an older project', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 'proj_full' })
    clipFindFirst.mockResolvedValueOnce({ id: 'clip_full_root' })

    const url = await resolveViewOnFullVideoUrl(
      'ws_1',
      'proj_full',
      defaultClipSettings({ fullVideo: true }),
      'upload_1',
      new Date('2026-11-01T00:00:00Z'),
    )

    expect(url).toBe('/app/video-editor/proj_full/edit/clip_full_root?highlights=1')
    expect(projectFindFirst).toHaveBeenCalledTimes(1)
    expect(projectFindFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'proj_full', workspaceId: 'ws_1', deletedAt: null },
    })
  })

  it('returns unavailable when no owned backing full project exists', async () => {
    projectFindFirst.mockResolvedValueOnce(null)

    const url = await resolveViewOnFullVideoUrl(
      'ws_1',
      'proj_short',
      defaultClipSettings(),
      'upload_1',
      new Date('2026-11-01T00:00:00Z'),
    )

    expect(url).toBeNull()
    expect(projectFindFirst).toHaveBeenCalledTimes(1)
    expect(projectFindFirst.mock.calls[0]?.[0]).toMatchObject({
      where: {
        workspaceId: 'ws_1',
        uploadId: 'upload_1',
        deletedAt: null,
        settings: { path: ['fullVideo'], equals: true },
      },
    })
    expect(clipFindFirst).not.toHaveBeenCalled()
  })
})
