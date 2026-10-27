import { describe, expect, it } from 'vitest'
import { findDynamicSlugConflicts } from '../scripts/check-next-dynamic-route-slugs'

describe('Next.js dynamic route slugs', () => {
  it('has no sibling dynamic folders with different param names under app/', () => {
    const conflicts = findDynamicSlugConflicts()
    expect(conflicts).toEqual([])
  })
})
