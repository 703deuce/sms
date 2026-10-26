import { describe, expect, it } from 'vitest'
import { montageCreateSchema } from '@/lib/server/streamer/montages'

describe('montage create schema', () => {
  it('parses defaults', () => {
    const parsed = montageCreateSchema.parse({ projectId: 'proj_1' })
    expect(parsed.topN).toBe(5)
    expect(parsed.transition).toBe('cut')
  })
})
