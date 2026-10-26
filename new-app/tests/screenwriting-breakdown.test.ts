import { describe, expect, it } from 'vitest'
import { breakdownReport } from '@/lib/screenwriting/breakdown/report'
import type { BreakdownTag } from '@/lib/screenwriting/breakdown/types'

describe('breakdown report', () => {
  it('groups tags by category', () => {
    const tags: BreakdownTag[] = [
      { id: '1', elementId: 'a', from: 0, to: 1, category: 'props', label: 'Gun' },
      { id: '2', elementId: 'b', from: 0, to: 1, category: 'cast', label: 'JACK' },
    ]
    const r = breakdownReport(tags)
    expect(r.find((x) => x.category === 'props')?.count).toBe(1)
    expect(r.find((x) => x.category === 'cast')?.items).toContain('JACK')
  })
})
