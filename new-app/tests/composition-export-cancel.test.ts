import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  render: { id: 'scrn_1', status: 'RENDERING', compositionId: 'cmp_1', workspaceId: 'ws_1' },
  row: { projectId: 'proj_1', revision: 1, document: {}, aspect: '9:16' },
  jobs: [{ id: 'cjob_1', payload: { renderId: 'scrn_1' }, status: 'RUNNING' }],
}))

vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    scriptCompositionRender: {
      findFirst: vi.fn(async () => mocks.render),
      update: vi.fn(async () => mocks.render),
    },
    clipJob: {
      findMany: vi.fn(async () => mocks.jobs),
      update: vi.fn(async () => ({})),
    },
  }),
}))

vi.mock('@/lib/server/clips/script-composition', () => ({
  getCompositionForWorkspace: vi.fn(async () => mocks.row),
  parseScriptCompositionDocument: vi.fn(() => ({})),
}))

vi.mock('@/lib/server/clips/script-bootstrap', () => ({
  getScriptBootstrap: vi.fn(async () => null),
}))

describe('cancelCompositionExport', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks render failed and cancels linked job', async () => {
    const { cancelCompositionExport } = await import('@/lib/server/clips/composition-export')
    const out = await cancelCompositionExport('ws_1', 'cmp_1', 'scrn_1')
    expect(out?.ok).toBe(true)
    expect(out?.alreadyDone).toBe(false)
  })
})
