import { describe, expect, it } from 'vitest'
import { AUTO_VERSION_EVERY } from '@/lib/server/clips/composition-versions'

describe('composition versions', () => {
  it('auto-versions every 8 revisions', () => {
    expect(AUTO_VERSION_EVERY).toBe(8)
    expect(8 % AUTO_VERSION_EVERY).toBe(0)
    expect(7 % AUTO_VERSION_EVERY).not.toBe(0)
  })
})
