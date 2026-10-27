import { describe, expect, it } from 'vitest'
import { sourceCutRegions } from '@/lib/clips/script-editor/cut-regions'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

function w(id: string, t0: number, t1: number): EditorWord {
  return {
    id,
    text: id,
    t0Ms: t0,
    t1Ms: t1,
    speakerId: 's1',
    speakerLabel: 'A',
    confidence: 1,
    isFiller: false,
  }
}

describe('sourceCutRegions', () => {
  it('groups contiguous deleted words', () => {
    const words = [w('a', 0, 100), w('b', 100, 200), w('c', 200, 300)]
    const deleted = new Set(['a', 'b'])
    const regions = sourceCutRegions(words, deleted, 0)
    expect(regions).toHaveLength(1)
    expect(regions[0].wordIds).toEqual(['a', 'b'])
    expect(regions[0].loMs).toBe(0)
    expect(regions[0].hiMs).toBe(200)
  })
})
