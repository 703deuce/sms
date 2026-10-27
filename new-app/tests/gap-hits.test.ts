import { describe, expect, it } from 'vitest'
import { listGapHits } from '@/lib/clips/script-editor/gap-hits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

function w(id: string, t0: number, t1: number, gap?: number): EditorWord {
  return {
    id,
    index: 0,
    t0Ms: t0,
    t1Ms: t1,
    text: id,
    speakerId: 'spk:0',
    gapBeforeMs: gap,
  }
}

describe('listGapHits', () => {
  const words = [w('a', 0, 400), w('b', 2000, 2400, 1600)]

  it('finds gaps more than threshold', () => {
    const hits = listGapHits(words, new Set(), { mode: 'more_than', minGapMs: 1000 })
    expect(hits).toHaveLength(1)
    expect(hits[0].gapMs).toBe(1600)
  })
})
