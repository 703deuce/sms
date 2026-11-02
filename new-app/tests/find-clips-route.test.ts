import { describe, expect, it, vi } from 'vitest'

const createFindClipsProjectFromFullVideo = vi.fn(async () => ({ id: 'proj_clips' }))

vi.mock('@/lib/server/dev-api-guard', () => ({ assertDevApiAccess: () => null }))
vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: async () => 'ws' }))
vi.mock('@/lib/server/clips/serialize', () => ({ serializeProject: (p: { id: string }) => p }))
vi.mock('@/lib/server/clips/full-video-projects', () => ({
  createFindClipsProjectFromFullVideo,
  findClipSettingsFor: vi.fn(),
}))
vi.mock('@/lib/server/clips/find-clips-job', () => ({
  queueFindClipsJob: vi.fn(),
}))

describe('find-clips POST route', () => {
  it("defaults to legacy 'project' mode", async () => {
    const { POST } = await import('@/app/api/clips/projects/[id]/find-clips/route')
    const res = await POST(new Request('http://x', { method: 'POST' }), { params: Promise.resolve({ id: 'fv1' }) })
    expect(res.status).toBe(200)
    expect(createFindClipsProjectFromFullVideo).toHaveBeenCalledWith('ws', 'fv1')
  })
})
