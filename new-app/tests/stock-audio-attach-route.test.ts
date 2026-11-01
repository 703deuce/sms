import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/server/workspace', () => ({ resolveWorkspaceId: vi.fn(async () => 'ws1') }))
vi.mock('@/lib/server/clips/clips', () => ({
  getClipForWorkspace: vi.fn(async () => ({ id: 'clip1', projectId: 'proj1' })),
}))
vi.mock('@/lib/server/ai/stock-audio', () => ({
  attachStockAudioToProject: vi.fn(async () => ({ uploadId: 'upl_stock' })),
}))

describe('stock-audio attach route', () => {
  it('returns uploadId from server attach', async () => {
    const { attachStockAudioToProject } = await import('@/lib/server/ai/stock-audio')
    const { POST } = await import('@/app/api/clips/clips/[id]/stock-audio/attach/route')
    const res = await POST(
      new Request('http://local/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stockId: 'kenney-pop' }),
      }),
      { params: Promise.resolve({ id: 'clip1' }) },
    )
    const body = await res.json()
    expect(body.data.uploadId).toBe('upl_stock')
    expect(attachStockAudioToProject).toHaveBeenCalledWith('ws1', 'proj1', 'kenney-pop')
  })
})
