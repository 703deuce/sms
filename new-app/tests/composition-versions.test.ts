import { describe, expect, it } from 'vitest'
import { AUTO_VERSION_EVERY } from '@/lib/server/clips/composition-versions'

describe('composition versions', () => {
  it('auto-versions every 50 revisions', () => {
    expect(AUTO_VERSION_EVERY).toBe(50)
    expect(50 % AUTO_VERSION_EVERY).toBe(0)
    expect(49 % AUTO_VERSION_EVERY).not.toBe(0)
  })
})
