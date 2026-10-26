import { describe, expect, it } from 'vitest'
import { shouldTouchLockedAt } from '@/lib/server/clips/jobs'

describe('progress heartbeat', () => {
  it('refreshes lock while job is RUNNING', () => {
    expect(shouldTouchLockedAt('RUNNING')).toBe(true)
    expect(shouldTouchLockedAt('RUNNING', 'RUNNING')).toBe(true)
    expect(shouldTouchLockedAt('RUNNING', undefined)).toBe(true)
  })

  it('does not touch DONE jobs unless body explicitly RUNNING', () => {
    expect(shouldTouchLockedAt('DONE')).toBe(false)
    expect(shouldTouchLockedAt('DONE', 'DONE')).toBe(false)
    expect(shouldTouchLockedAt('FAILED')).toBe(false)
  })
})
