import { describe, expect, it } from 'vitest'
import { markerAfterWordIndex } from '@/lib/clips/script-editor/marker-word-index'
import type { TimelineWordChip } from '@/lib/clips/script-editor/timeline-model'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

describe('markerAfterWordIndex', () => {
  it('places marker after first word when outMs is within second word', () => {
    const words: EditorWord[] = [
      { id: 'a', text: 'hi', t0Ms: 0, t1Ms: 500, speakerId: 's1' },
      { id: 'b', text: 'there', t0Ms: 500, t1Ms: 1000, speakerId: 's1' },
    ]
    const chips: TimelineWordChip[] = [
      { wordId: 'a', text: 'hi', outStartMs: 0, outEndMs: 500, deleted: false },
      { wordId: 'b', text: 'there', outStartMs: 500, outEndMs: 1000, deleted: false },
    ]
    const edl = [{ kind: 'source' as const, srcInMs: 0, srcOutMs: 1000, outInMs: 0, outOutMs: 1000 }]
    expect(markerAfterWordIndex(chips, words, edl, 600)).toBe(1)
  })
})
