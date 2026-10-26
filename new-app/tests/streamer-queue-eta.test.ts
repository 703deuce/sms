import { describe, expect, it } from 'vitest'
import { montageCreateSchema } from '@/lib/server/streamer/montages'

describe('montageCreateSchema', () => {
  it('accepts two or more clip ids', () => {
    const parsed = montageCreateSchema.parse({ projectId: 'proj_x', clipIds: ['c1', 'c2'] })
    expect(parsed.clipIds).toEqual(['c1', 'c2'])
  })
})
