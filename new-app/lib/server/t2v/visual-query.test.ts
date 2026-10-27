import { describe, expect, it } from 'vitest'
import { narrationVisualFallback } from '@/lib/server/t2v/visual-query'

describe('narrationVisualFallback', () => {
  it('keeps topic tokens with narration hints', () => {
    const q = narrationVisualFallback('We install panels on your roof this week.', 'residential solar')
    expect(q.toLowerCase()).toContain('solar')
    expect(q.toLowerCase()).toMatch(/panel|roof|install/)
  })
})
