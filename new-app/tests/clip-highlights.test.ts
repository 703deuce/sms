import { describe, expect, it, vi, beforeEach } from 'vitest'

const findMany = vi.fn()
const findFirst = vi.fn()
const findUnique = vi.fn()

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ clipProject: { findMany, findFirst, findUnique }, clip: { findMany } }),
}))

vi.mock('@/lib/storage', () => ({
  getClipStorageForObjectKey: vi.fn(),
}))

describe('getFullVideoHighlights', () => {
  beforeEach(() => {
    findMany.mockReset()
    findFirst.mockReset()
    findUnique.mockReset()
  })

  it('returns null when full-video project missing', async () => {
    findFirst.mockResolvedValueOnce(null)
    const { getFullVideoHighlights } = await import('@/lib/server/clips/clip-highlights')
    const res = await getFullVideoHighlights('ws', 'fv1')
    expect(res).toBeNull()
  })
})
