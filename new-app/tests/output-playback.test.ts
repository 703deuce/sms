import { describe, expect, it } from 'vitest'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { edlUsesOutputClock, sourceMsAtOutput } from '@/lib/clips/script-editor/output-playback'

const words: EditorWord[] = [
  { id: 'm:0', index: 0, t0Ms: 0, t1Ms: 500, text: 'hi', speakerId: 'spk:0' },
]

describe('output-playback', () => {
  it('detects gap segments', () => {
    const doc = {
      v: 1 as const,
      keptWordIds: ['m:0'],
      deletedWordIds: [],
      gapInserts: [{ afterWordId: 'm:0', durMs: 2000 }],
    }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    expect(edlUsesOutputClock(edl)).toBe(true)
    const srcMidGap = sourceMsAtOutput(600, edl, 0)
    expect(srcMidGap).toBe(500)
  })
})
