import { describe, expect, it, vi, beforeEach } from 'vitest'

const listProjectSelects = vi.fn()

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: vi.fn(async () => 'ws_1'),
}))

vi.mock('@/lib/server/clips/project-selects', () => ({
  listProjectSelects: (...args: unknown[]) => listProjectSelects(...args),
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clipProject: {
      findFirst: vi.fn(async () => ({ id: 'proj_1' })),
    },
  }),
}))

describe('GET /api/clips/projects/[id]/selects', () => {
  beforeEach(() => {
    listProjectSelects.mockReset()
  })

  it('returns project selects', async () => {
    listProjectSelects.mockResolvedValue([
      { id: 'sel_1', sourceId: 'main', kind: 'main', label: 'Main', startMs: 0, endMs: 1000, snippet: null, sortOrder: 0 },
    ])
    const { GET } = await import('@/app/api/clips/projects/[id]/selects/route')
    const res = await GET(new Request('http://test'), { params: Promise.resolve({ id: 'proj_1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.items).toHaveLength(1)
  })
})
