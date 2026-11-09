import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  count: 0,
  cap: 2,
  calls: 0,
}))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({
  getPrisma: () => ({
    $queryRaw: async () => {
      state.calls++
      state.count++
      return state.count <= state.cap ? [{ used: state.count }] : []
    },
  }),
}))
import { motionBudgetWindow, reserveMotionRequest, MOTION_HOURLY_LIMITS } from '@/lib/server/clips/motion-request-limit'

describe('motion AI paid request rate limits', () => {
  beforeEach(() => { state.count = 0; state.calls = 0; state.cap = 2 })
  it('uses UTC aligned hours and returns correct retry wait', () => {
    expect(motionBudgetWindow(0).start.toISOString()).toBe('1970-01-01T00:00:00.000Z')
    expect(motionBudgetWindow(0).retryAfterSec).toBe(3600)
    expect(motionBudgetWindow(3599999).retryAfterSec).toBe(1)
    expect(motionBudgetWindow(3600000).retryAfterSec).toBe(3600)
  })
  it('has a bounded finite budget for every paid model action', () => {
    expect(Object.values(MOTION_HOURLY_LIMITS).every(x => Number.isInteger(x) && x > 0 && x <= 100)).toBe(true)
  })
  it('reserves through an atomic store and returns 429 metadata at cap', async () => {
    const a = await reserveMotionRequest('ws_test', 'generate', 0)
    const b = await reserveMotionRequest('ws_test', 'generate', 0)
    const c = await reserveMotionRequest('ws_test', 'generate', 0)
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(c).toEqual({ ok: false, retryAfterSec: 3600 })
    expect(state.calls).toBe(3)
  })
  it('rejects missing workspace identifiers before issuing SQL', async () => {
    await expect(reserveMotionRequest('', 'revise')).rejects.toThrow('motion_budget_missing_workspace')
    expect(state.calls).toBe(0)
  })
})
