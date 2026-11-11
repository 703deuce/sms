import { beforeEach, describe, expect, it, vi } from 'vitest'
const findMany = vi.hoisted(() => vi.fn(async (_args: unknown) => []))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => ({ clipProject: { findMany } }) }))
vi.mock('@/lib/server/clips/feature-gates', () => ({ isT2vFeatureEnabled: () => true }))

beforeEach(() => vi.clearAllMocks())

describe('LG10 explicit draft project filter', () => {
  it('filters DRAFT only on user request and preserves all statuses by default', async () => {
    const { listClipProjects } = await import('@/lib/server/clips/projects')
    await listClipProjects('fixture_ws', { status: 'draft' })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'fixture_ws', status: 'DRAFT', deletedAt: null }),
    }))
    await listClipProjects('fixture_ws', { status: 'all' })
    const where = (findMany.mock.calls.at(-1)?.[0] as { where: Record<string, unknown> }).where
    expect(where).not.toHaveProperty('status')
    expect(where).toHaveProperty('deletedAt', null)
  })
  it('keeps existing processing filter exclusive of draft and failed', async () => {
    const { listClipProjects } = await import('@/lib/server/clips/projects')
    await listClipProjects('fixture_ws', { status: 'processing' })
    expect((findMany.mock.calls.at(-1)?.[0] as { where: { status: { notIn: string[] } } }).where.status.notIn).toContain('DRAFT')
    expect((findMany.mock.calls.at(-1)?.[0] as { where: { status: { notIn: string[] } } }).where.status.notIn).toContain('FAILED')
  })
})
