import { describe, expect, it } from 'vitest'
import { splitScript } from '@/lib/t2v/split-script'

describe('splitScript', () => {
  it('splits by sentence', () => {
    const parts = splitScript('Solar panels convert sunlight into electricity. They lower your bill.', 'sentence')
    expect(parts).toHaveLength(2)
  })

  it('splits by line break', () => {
    expect(splitScript('a\n\nb', 'line_break')).toEqual(['a', 'b'])
  })
})
