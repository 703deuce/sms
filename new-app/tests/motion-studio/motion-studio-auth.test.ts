// @ts-ignore vitest is resolved in new-app; root tsc has no vitest types
import { beforeEach, describe, expect, it, vi } from 'vitest'

const resolveWorkspaceId = vi.fn(async () => 'ws_default')
const resolveClipsActorUserId = vi.fn(async (_request?: Request) => 'user_operator')

vi.mock('@/lib/server/workspace', () => ({
  resolveWorkspaceId: (...args: unknown[]) => resolveWorkspaceId(...args),
}))

vi.mock('@/lib/server/clips/clips-auth', () => ({
  resolveClipsActorUserId: (...args: unknown[]) => resolveClipsActorUserId(...(args as [Request?])),
}))

describe('Motion Studio caller resolution (no login gate)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveWorkspaceId.mockResolvedValue('ws_default')
    resolveClipsActorUserId.mockResolvedValue('user_operator')
  })

  it('uses the default workspace and operator when there is no session, and does not 401', async () => {
    const { requireMotionStudioCaller } = await import('@/lib/server/motion-studio/auth')
    const request = new Request('http://local/api/motion-studio/projects', { method: 'POST' })
    const caller = await requireMotionStudioCaller(request)
    expect(caller).toEqual({ userId: 'user_operator', workspaceId: 'ws_default' })
    expect(resolveWorkspaceId).toHaveBeenCalledOnce()
    expect(resolveClipsActorUserId).toHaveBeenCalledWith(request)
  })

  it('uses a signed-in user when the rest of the app would, still on the default workspace', async () => {
    resolveClipsActorUserId.mockResolvedValue('user_signed_in')
    const { requireMotionStudioCaller } = await import('@/lib/server/motion-studio/auth')
    const caller = await requireMotionStudioCaller(new Request('http://local/api/motion-studio/projects'))
    expect(caller).toEqual({ userId: 'user_signed_in', workspaceId: 'ws_default' })
  })

  it('POST /api/motion-studio/projects creates without a session (no 401)', async () => {
    const created = { project: { id: 'ms_new' }, created: true }
    const createProject = vi.fn(async () => created)
    const listProjects = vi.fn(async () => ({ projects: [], nextCursor: null }))
    vi.resetModules()
    resolveWorkspaceId.mockResolvedValue('ws_default')
    resolveClipsActorUserId.mockResolvedValue('user_operator')
    vi.doMock('@/lib/server/workspace', () => ({
      resolveWorkspaceId: (...args: unknown[]) => resolveWorkspaceId(...args),
    }))
    vi.doMock('@/lib/server/clips/clips-auth', () => ({
      resolveClipsActorUserId: (...args: unknown[]) => resolveClipsActorUserId(...(args as [Request?])),
    }))
    vi.doMock('@/lib/server/motion-studio/service', () => ({ createProject, listProjects }))

    const { POST } = await import('@/app/api/motion-studio/projects/route')
    const res = await POST(
      new Request('http://local/api/motion-studio/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow: 'idea', prompt: 'How Blockbuster collapsed', idempotencyKey: 'k1' }),
      }),
    )
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ project: created.project })
    expect(createProject).toHaveBeenCalledWith(
      'ws_default',
      'user_operator',
      expect.objectContaining({ prompt: 'How Blockbuster collapsed' }),
      null,
    )
  })
})
