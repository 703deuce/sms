import { describe, expect, it } from 'vitest'
import { clampScriptSplitPct, SCRIPT_SPLIT_DEFAULT } from '@/lib/clips/editor/use-script-view-split'

describe('script view split', () => {
  it('defaults to 40% transcript width', () => {
    expect(SCRIPT_SPLIT_DEFAULT).toBe(0.4)
  })

  it('clamps split ratio', () => {
    expect(clampScriptSplitPct(0.1)).toBe(0.3)
    expect(clampScriptSplitPct(0.4)).toBe(0.4)
    expect(clampScriptSplitPct(0.95)).toBe(0.5)
  })
})
