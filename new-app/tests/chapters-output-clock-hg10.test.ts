import { describe, expect, it } from 'vitest'
import { deriveEdl, sourceMsToOutputTime } from '@/lib/clips/script-edl/derive-edl'
import { outputDurationMs } from '@/lib/clips/script-edl/edl-playback'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

function word(id: string, t0Ms: number, t1Ms: number): EditorWord {
  return { id, index: Number(id.slice(1)), text: id, t0Ms, t1Ms, speakerId: 'spk:0' }
}

describe('HG10 generated chapter output-clock fixtures', () => {
  it('anchors kept transcript timestamps after removed footage and an inserted gap', () => {
    const words = [word('w0', 0, 1000), word('w1', 10_000, 11_000), word('w2', 20_000, 21_000)]
    const doc: ScriptDocumentV1 = {
      v: 1,
      keptWordIds: ['w0', 'w2'],
      deletedWordIds: ['w1'],
      wordOrder: ['w0', 'w1', 'w2'],
      gapInserts: [{ afterWordId: 'w0', durMs: 2000 }],
    }
    const edl = deriveEdl(doc, new Map(words.map((w) => [w.id, w])), { padMs: 0 })
    expect(sourceMsToOutputTime(0, edl)).toBe(0)
    expect(sourceMsToOutputTime(10_000, edl)).toBeNull()
    expect(sourceMsToOutputTime(20_000, edl)).toBe(3000)
    expect(outputDurationMs(edl)).toBe(4000)
  })

  it('keeps chapter marker output times intact in exported descriptions', async () => {
    const { youtubeChaptersText } = await import('@/lib/clips/script-editor/chapters-export')
    expect(youtubeChaptersText({
      v: 1, keptWordIds: [], deletedWordIds: [],
      markers: [{ id: 'intro', outMs: 0, label: 'Start' }, { id: 'later', outMs: 65000, label: 'Later section' }],
    })).toContain('1:05 Later section')
  })
})
