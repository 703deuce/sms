import { beforeEach, describe, expect, it, vi } from 'vitest'

const { projectFindFirst, projectRaw } = vi.hoisted(() => ({
  projectFindFirst: vi.fn(),
  projectRaw: vi.fn(),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: { findFirst: projectFindFirst },
    $queryRaw: projectRaw,
  }),
}))

vi.mock('@/lib/supabase/id', () => ({
  createId: (prefix: string) => `${prefix}_new`,
}))

vi.mock('@/lib/storage', () => ({
  projectWordsKey: (workspaceId: string, projectId: string) => `ws/${workspaceId}/projects/${projectId}/words.json`,
}))

import {
  createFullVideoProjectForUpload,
  ensureFullVideoProjectForUpload,
} from '@/lib/server/clips/ensure-full-video-project'

const upload = {
  id: 'up_1',
  durationMs: 60_000,
  width: 1920,
  height: 1080,
  filename: 'talk.mp4',
}

const sourceProject = {
  id: 'proj_source',
  title: 'Talk',
  transcriptWords: [{ w: 'hello', s: 0, e: 1, i: 0 }],
  proxyKey: 'proxy.mp4',
  rangeEndMs: 60_000,
}

describe('full-video project creation and concurrency', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    projectFindFirst.mockResolvedValue(null)
    projectRaw.mockResolvedValue([{
      projectId: 'proj_fv_up_1',
      clipId: 'clip_fv_up_1',
      dbStatementMs: 5,
    }])
  })

  it('creates a project, seeded clip and processing job atomically in one statement', async () => {
    const result = await createFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(result).toEqual({ projectId: 'proj_fv_up_1', clipId: 'clip_fv_up_1' })
    expect(projectRaw).toHaveBeenCalledTimes(1)
    expect(projectFindFirst).not.toHaveBeenCalled()

    const sql = (projectRaw.mock.calls[0]?.[0] as TemplateStringsArray).join('?')
    expect(sql).toContain('WITH created_project AS')
    expect(sql).toContain('INSERT INTO clip_projects')
    expect(sql).toContain('INSERT INTO clips')
    expect(sql).toContain('INSERT INTO clip_jobs')
    expect(sql).toContain('ON CONFLICT (id) DO NOTHING')
    expect(sql).toContain('LEFT JOIN seeded_clip')
    expect(sql).toContain('"proxyKey", "updatedAt"')
    expect(sql).toContain('"aiMeta", "updatedAt"')
    const args = projectRaw.mock.calls[0]?.slice(1) ?? []
    expect(args).toContain('proj_fv_up_1')
    expect(args).toContain('clip_fv_up_1')
    expect(args).toContain(JSON.stringify(sourceProject.transcriptWords))
    expect(args).toContain('proxy.mp4')
    expect(args).toContain('job_new')
    expect(args.some((a) => typeof a === 'string' && a.includes('"preseededFullVideo":true'))).toBe(true)
  })

  it('keeps the original ensure API and reuses an existing full-video project', async () => {
    projectFindFirst.mockResolvedValueOnce({ id: 'proj_existing', settings: { fullVideo: true } })
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_existing')
    expect(projectRaw).not.toHaveBeenCalled()
    expect(projectFindFirst).toHaveBeenCalledTimes(1)
  })

  it('the original ensure API creates once when no project exists', async () => {
    const projectId = await ensureFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(projectId).toBe('proj_fv_up_1')
    expect(projectFindFirst).toHaveBeenCalledTimes(2)
    expect(projectRaw).toHaveBeenCalledTimes(1)
  })

  it('returns the actual concurrent winner without a second project or job', async () => {
    projectRaw.mockResolvedValueOnce([])
    projectFindFirst.mockResolvedValueOnce({
      id: 'proj_fv_up_1',
      settings: { fullVideo: true },
      clips: [{ id: 'clip_fv_up_1' }],
    })
    const result = await createFullVideoProjectForUpload('ws_1', upload, sourceProject)
    expect(result).toEqual({ projectId: 'proj_fv_up_1', clipId: 'clip_fv_up_1' })
    expect(projectRaw).toHaveBeenCalledTimes(1)
    expect(projectFindFirst).toHaveBeenCalledTimes(1)
  })

  it('does not seed a made-up clip when the source duration is unknown', async () => {
    projectRaw.mockResolvedValueOnce([{ projectId: 'proj_fv_up_1', clipId: null, dbStatementMs: 4 }])
    const result = await createFullVideoProjectForUpload('ws_1', { ...upload, durationMs: null }, sourceProject)
    expect(result).toEqual({ projectId: 'proj_fv_up_1', clipId: null })
    const params = projectRaw.mock.calls[0]?.slice(1) ?? []
    expect(params).toContain(null)
  })
})
