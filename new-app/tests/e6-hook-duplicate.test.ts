import { describe, expect, it } from 'vitest'
import { hookTextDuplicatesCaptions } from '@/lib/clips/hook-duplicate'

const w = (text: string, start = 0, step = 0.3) => text.split(' ').map((t, i) => ({ w: t, s: start + i * step }))

describe('E6 hook duplicates captions (parity with worker hook_duplicate.py)', () => {
  it('spoken first line is a duplicate', () => {
    expect(hookTextDuplicatesCaptions('Straight up boxing combat applied to', w('Straight up boxing combat applied to MMA is the thing'), 2200)).toBe(true)
  })
  it('editorial hook is not', () => {
    expect(hookTextDuplicatesCaptions('He never saw it coming', w('so we went to the store and bought bread'), 2200)).toBe(false)
  })
  it('words after the window do not count', () => {
    expect(hookTextDuplicatesCaptions('Straight up boxing combat', [...w('um yeah'), ...w('straight up boxing combat', 10)], 2200)).toBe(false)
  })
  it('punctuation and case ignored', () => {
    expect(hookTextDuplicatesCaptions('A good...', w('a good one, honestly'), 2200)).toBe(true)
  })
  it('empty inputs', () => {
    expect(hookTextDuplicatesCaptions('', w('a b'), 2200)).toBe(false)
    expect(hookTextDuplicatesCaptions('hello there', [], 2200)).toBe(false)
  })
})
