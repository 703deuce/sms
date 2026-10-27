import { describe, expect, it } from 'vitest'
import { listFillerHits } from '@/lib/clips/script-editor/filler-hits'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

function ew(id: string, text: string, filler?: boolean): EditorWord {
  return {
    id,
    index: 0,
    t0Ms: 0,
    t1Ms: 200,
    text,
    speakerId: 'spk:0',
    isFiller: filler,
    fillerKind: filler ? 'lexicon' : undefined,
  }
}

describe('listFillerHits', () => {
  const words = [ew('a', 'hi'), ew('b', 'um', true), ew('c', 'there')]

  it('lists non-deleted fillers', () => {
    const hits = listFillerHits(words, new Set())
    expect(hits).toHaveLength(1)
    expect(hits[0].word.id).toBe('b')
  })

  it('respects selection scope', () => {
    const hits = listFillerHits(words, new Set(), {
      selectionOnly: true,
      selectedIds: new Set(['c']),
    })
    expect(hits).toHaveLength(0)
  })
})
