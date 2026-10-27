import { describe, expect, it } from 'vitest'
import { documentFromClipEdits } from '@/lib/clips/script-edl/clip-bridge'
import { deriveEdl, outputTimeToSourceMs } from '@/lib/clips/script-edl/derive-edl'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import { normalizeEdits } from '@/lib/clips/edits'

const words: EditorWord[] = [
  { id: 'm:0', index: 0, t0Ms: 0, t1Ms: 500, text: 'one', speakerId: 'spk:0' },
  { id: 'm:1', index: 1, t0Ms: 1000, t1Ms: 1500, text: 'two', speakerId: 'spk:0' },
  { id: 'm:2', index: 2, t0Ms: 2000, t1Ms: 2500, text: 'three', speakerId: 'spk:0' },
]

describe('deriveEdl', () => {
  it('skips deleted words and produces contiguous output', () => {
    const doc = documentFromClipEdits(words, normalizeEdits({ cutRanges: [[900, 1600]] }, { clipStartMs: 0, clipEndMs: 3000 }))
    expect(doc.deletedWordIds).toContain('m:1')
    const byId = new Map(words.map((w) => [w.id, w]))
    const edl = deriveEdl(doc, byId, { padMs: 0 })
    expect(edl.length).toBe(2)
    expect(edl[0].kind).toBe('source')
    if (edl[0].kind === 'source') {
      expect(edl[0].srcInMs).toBe(0)
      expect(edl[0].srcOutMs).toBe(500)
    }
  })

  it('maps output time back to source', () => {
    const doc = { v: 1 as const, keptWordIds: ['m:0'], deletedWordIds: [] }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    const src = outputTimeToSourceMs(100, edl)
    expect(src).not.toBeNull()
  })
})
