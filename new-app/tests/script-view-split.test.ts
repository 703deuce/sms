import { describe, expect, it } from 'vitest'
import { clampScriptSplitPct, SCRIPT_SPLIT_DEFAULT } from '@/lib/clips/editor/use-script-view-split'

describe('script view split', () => {
  it('defaults to 55% transcript width', () => {
    expect(SCRIPT_SPLIT_DEFAULT).toBe(0.55)
  })

  it('clamps split ratio', () => {
    expect(clampScriptSplitPct(0.1)).toBe(0.35)
    expect(clampScriptSplitPct(0.55)).toBe(0.55)
    expect(clampScriptSplitPct(0.95)).toBe(0.75)
  })
})
