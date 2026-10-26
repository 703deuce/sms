import { describe, expect, it } from 'vitest'
import { applyProducerToolsWithWords } from '@/lib/clips/edits-reducer'
import { defaultEdits } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
const words = [
  { w: 'hi', s: 0, e: 1, i: 0 },
  { w: 'there', s: 2.2, e: 3, i: 1 },
]

describe('F5 producer tools', () => {
  it('set_zoom stores zoom settings', () => {
    const base = defaultEdits(bounds)
    const { edits } = applyProducerToolsWithWords(base, bounds, [
      { name: 'set_zoom', args: { enabled: true, intensity: 1.2 } },
    ], words)
    expect(edits.zoom?.enabled).toBe(true)
    expect(edits.zoom?.intensity).toBe(1.2)
  })

  it('apply_silence_trim merges cut ranges', () => {
    const base = defaultEdits(bounds)
    const { edits } = applyProducerToolsWithWords(base, bounds, [
      { name: 'apply_silence_trim', args: { minGapMs: 600, keepMs: 150 } },
    ], words)
    expect(edits.cutRanges.length).toBeGreaterThan(0)
    expect(edits.silenceTrim?.enabled).toBe(true)
  })
})
