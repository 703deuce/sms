import { describe, expect, it } from 'vitest'
import { deriveEdl } from '@/lib/clips/script-edl/derive-edl'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { groupWordbarItems, timelineClipsFromEdl, wordIndicesInOutputRange } from '@/lib/clips/script-editor/timeline-model'

const words: EditorWord[] = [
  { id: 'm:0', index: 0, t0Ms: 0, t1Ms: 400, text: 'hi', speakerId: 'spk:0' },
  { id: 'm:1', index: 1, t0Ms: 500, t1Ms: 900, text: 'there', speakerId: 'spk:0' },
]

describe('timeline-model', () => {
  it('groups wordbar chips when zoomed out', () => {
    const doc = { v: 1 as const, keptWordIds: ['m:0', 'm:1'], deletedWordIds: [] }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    const chips = words.map((w, i) => ({
      wordId: w.id,
      text: w.text,
      outStartMs: i * 400,
      outEndMs: (i + 1) * 400,
      deleted: false,
    }))
    const grouped = groupWordbarItems(chips, 0.01)
    expect(grouped.some((g) => g.kind === 'group')).toBe(true)
  })

  it('splits script track clips at split markers', () => {
    const doc = { v: 1 as const, keptWordIds: ['m:0', 'm:1'], deletedWordIds: [], splitAtOutMs: [400] }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    const clips = timelineClipsFromEdl(edl, doc.splitAtOutMs)
    expect(clips.filter((c) => c.kind === 'source').length).toBeGreaterThan(1)
  })

  it('maps output drag range to word indices', () => {
    const doc = { v: 1 as const, keptWordIds: ['m:0', 'm:1'], deletedWordIds: [] }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    const chips = [
      { wordId: 'm:0', text: 'hi', outStartMs: 0, outEndMs: 400, deleted: false },
      { wordId: 'm:1', text: 'there', outStartMs: 400, outEndMs: 900, deleted: false },
    ]
    const range = wordIndicesInOutputRange(chips, words, 0, 500)
    expect(range).toEqual({ lo: 0, hi: 1 })
  })
})

describe('deriveEdl gaps', () => {
  it('extends output duration with gap inserts', () => {
    const doc = {
      v: 1 as const,
      keptWordIds: ['m:0'],
      deletedWordIds: [],
      gapInserts: [{ afterWordId: 'm:0', durMs: 1000 }],
    }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    expect(outputDurationMs(edl)).toBeGreaterThan(400)
  })
})
