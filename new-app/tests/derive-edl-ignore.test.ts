import { describe, expect, it } from 'vitest'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { applyCompositionOp, emptyDocument } from '@/lib/clips/script-edl/ops'

describe('deriveEdl ignore', () => {
  const words: EditorWord[] = [
    { id: 'a:0', text: 'hi', t0Ms: 0, t1Ms: 500, speakerId: 's1' },
    { id: 'a:1', text: 'um', t0Ms: 2000, t1Ms: 2500, speakerId: 's1', isFiller: true },
    { id: 'a:2', text: 'there', t0Ms: 5000, t1Ms: 5500, speakerId: 's1' },
  ]
  const map = new Map(words.map((w) => [w.id, w]))

  it('ignoring a word does not shorten output duration', () => {
    const base = emptyDocument(words.map((w) => w.id))
    const ignored = applyCompositionOp(base, { type: 'ignore_words', wordIds: ['a:1'] })
    const durBefore = outputDurationMs(deriveEdl(base, map, { padMs: 0 }))
    const durAfter = outputDurationMs(deriveEdl(ignored, map, { padMs: 0 }))
    expect(durAfter).toBe(durBefore)
  })
})
