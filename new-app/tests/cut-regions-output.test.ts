import { describe, expect, it } from 'vitest'
import { outputCutRegions } from '@/lib/clips/script-editor/cut-regions'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

describe('outputCutRegions', () => {
  it('maps deleted words to output timeline spans', () => {
    const words: EditorWord[] = [
      { id: 'a', index: 0, text: 'hi', t0Ms: 0, t1Ms: 400, speakerId: 'S1' },
      { id: 'b', index: 1, text: 'um', t0Ms: 2000, t1Ms: 2400, speakerId: 'S1' },
      { id: 'c', index: 2, text: 'bye', t0Ms: 4000, t1Ms: 4400, speakerId: 'S1' },
    ]
    const byId = new Map(words.map((w) => [w.id, w]))
    const document = {
      v: 1 as const,
      keptWordIds: ['a', 'c'],
      deletedWordIds: ['b'],
      wordOrder: ['a', 'b', 'c'],
    }
    const edl = deriveEdl(document, byId)
    const regions = outputCutRegions(words, new Set(['b']), edl, 0)
    expect(regions.length).toBe(1)
    expect(regions[0].wordIds).toEqual(['b'])
    expect(regions[0].hiMs).toBeGreaterThan(regions[0].loMs)
  })
})
