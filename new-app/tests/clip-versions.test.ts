import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('@/lib/server/db', () => ({
  getPrisma: vi.fn(),
}))

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: vi.fn(async () => 'ws_test'),
}))

vi.mock('@/lib/server/clips/clips', () => ({
  getClipForWorkspace: vi.fn(async () => ({
    id: 'clip_test',
    workspaceId: 'ws_test',
    editsSaveVersion: 0,
    edits: { v: 2 },
  })),
}))

describe('clip edit versions routes', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns 503 when versions table missing', async () => {
    const { getPrisma } = await import('@/lib/server/db')
    vi.mocked(getPrisma).mockReturnValue({
      clipEditVersion: {
        findMany: vi.fn(async () => {
          throw Object.assign(new Error('missing'), { code: 'P2021' })
        }),
      },
    } as never)
    const { listClipEditVersions } = await import('@/lib/server/clips/clip-edit-versions')
    const result = await listClipEditVersions('ws_test', 'clip_test')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.code).toBe('VERSIONS_UNAVAILABLE')
  })
})
