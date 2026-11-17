import { beforeEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ deleted: 0, execute: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({ $executeRaw: state.execute }),
}))
import { deleteBrandKit } from '../../lib/server/motion-studio/brand-kits'

const id = 'msbk_123e4567-e89b-12d3-a456-426614174000'
describe('workspace Brand Kit deletion', () => {
  beforeEach(() => { state.execute.mockReset() })
  it('rejects a malformed ID without touching the database', async () => {
    await expect(deleteBrandKit('ws_one', 'bad')).rejects.toThrow('Invalid Brand Kit ID')
    expect(state.execute).not.toHaveBeenCalled()
  })
  it('reports not found when ID belongs to another workspace or was deleted', async () => {
    state.execute.mockResolvedValueOnce(0)
    await expect(deleteBrandKit('ws_one', id)).rejects.toThrow('not found in this workspace')
  })
  it('only reports success when the scoped deletion affects a row', async () => {
    state.execute.mockResolvedValueOnce(1)
    await expect(deleteBrandKit('ws_one', id)).resolves.toBeUndefined()
  })
})
