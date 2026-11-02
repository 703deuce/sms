import { describe, expect, it, vi, beforeEach } from 'vitest'
import { clipProjectListSelect } from '@/lib/server/clips/projects'
import type { ClipProjectListItem } from '@/lib/clips/project-list-item'

const {
  listClipProjects,
  groupBy,
  queryRaw,
  userFindMany,
  publishFindMany,
  clipFindFirst,
} = vi.hoisted(() => ({
  listClipProjects: vi.fn(),
  groupBy: vi.fn(),
  queryRaw: vi.fn(),
  userFindMany: vi.fn(),
  publishFindMany: vi.fn(),
  clipFindFirst: vi.fn(),
}))

vi.mock('@/lib/server/clips/projects', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/server/clips/projects')>()
  return { ...orig, listClipProjects }
})
vi.mock('@/lib/storage/resolve', () => ({
  createReadableSignedUrl: vi.fn(async () => 'https://signed/thumb'),
}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    clip: { groupBy, findFirst: clipFindFirst },
    user: { findMany: userFindMany },
    scriptCompositionPublish: { findMany: publishFindMany },
    t2vDraft: {},
    $queryRaw: queryRaw,
    clipProject: { update: vi.fn().mockResolvedValue({}) },
  }),
}))

describe('Q6-fix3 clip project list perf', () => {
  it('list select excludes transcriptWords blob', () => {
    expect('transcriptWords' in clipProjectListSelect).toBe(false)
    expect(clipProjectListSelect.id).toBe(true)
    expect(clipProjectListSelect.transcriptKey).toBe(true)
  })

  it('ClipProjectListItem shape has no transcriptWords field', () => {
    const item = {
      id: 'proj_x',
      workspaceId: 'ws',
      title: 't',
      uploadId: null,
      sourceUrl: null,
      rangeStartMs: 0,
      rangeEndMs: 60_000,
      status: 'READY' as const,
      stage: null,
      progress: 100,
      error: null,
      transcriptKey: 'ws/ws/projects/proj_x/words.json',
      thumbKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdById: 'dev',
      folderId: null,
      deletedAt: null,
      sourceKind: 'upload',
      lastViewedAt: null,
      clipCount: 3,
      durationMs: 60_000,
      thumbUrl: null,
    } satisfies ClipProjectListItem
    expect('transcriptWords' in item).toBe(false)
    expect(item.transcriptKey).toContain('words.json')
  })
})

describe('PERF-2 listClipProjectsForPage concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listClipProjects.mockResolvedValue([
      {
        id: 'p1',
        workspaceId: 'ws',
        title: 'T',
        uploadId: null,
        sourceUrl: null,
        rangeStartMs: 0,
        rangeEndMs: 1000,
        status: 'READY',
        stage: null,
        progress: 100,
        error: null,
        transcriptKey: null,
        thumbKey: 'thumb.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
        createdById: 'u1',
        folderId: null,
        deletedAt: null,
        sourceKind: 't2v',
        lastViewedAt: null,
      },
    ])
    groupBy.mockImplementation(async () => {
      await Promise.resolve()
      return [{ projectId: 'p1', _count: { _all: 2 } }]
    })
    queryRaw.mockImplementation(async () => [])
    userFindMany.mockImplementation(async () => [{ id: 'u1', name: 'Dev' }])
    publishFindMany.mockImplementation(async () => [])
    clipFindFirst.mockResolvedValue(null)
  })

  it('starts groupBy, t2v, users and publishes before any resolves', async () => {
    const order: string[] = []
    const gate = { open: false }
    const track = (name: string) => {
      order.push(`${name}:start`)
      return new Promise<void>((resolve) => {
        const tick = () => {
          if (gate.open) {
            order.push(`${name}:after`)
            resolve()
          } else setTimeout(tick, 0)
        }
        tick()
      })
    }

    groupBy.mockImplementation(() => track('groupBy').then(() => [{ projectId: 'p1', _count: { _all: 1 } }]))
    queryRaw.mockImplementation(() => track('t2v').then(() => []))
    userFindMany.mockImplementation(() => track('users').then(() => []))
    publishFindMany.mockImplementation(() => track('publishes').then(() => []))

    const { listClipProjectsForPage } = await import('@/lib/server/clips/project-list')
    const run = listClipProjectsForPage('ws', {})
    await new Promise((r) => setTimeout(r, 5))
    gate.open = true
    await run

    const starts = order.filter((e) => e.endsWith(':start')).map((e) => e.split(':')[0]!)
    expect(starts).toEqual(expect.arrayContaining(['groupBy', 't2v', 'users', 'publishes']))
    const firstAfter = order.findIndex((e) => e.endsWith(':after'))
    expect(order.slice(0, firstAfter).every((e) => e.endsWith(':start'))).toBe(true)
  })
})
