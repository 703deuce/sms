import { describe, expect, it } from 'vitest'
import { transcriptFindHits } from '@/lib/clips/script-editor/transcript-find'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

const words: EditorWord[] = [
  { id: 'a:0', index: 0, t0Ms: 0, t1Ms: 200, text: 'comic', speakerId: 'spk:0', conf: 1, isFiller: false },
  { id: 'a:1', index: 1, t0Ms: 300, t1Ms: 500, text: 'books', speakerId: 'spk:0', conf: 1, isFiller: false },
  { id: 'a:2', index: 2, t0Ms: 600, t1Ms: 900, text: 'comic', speakerId: 'spk:0', conf: 1, isFiller: false },
]

describe('transcriptFindHits', () => {
  it('finds substring matches case-insensitively', () => {
    const hits = transcriptFindHits(words, new Set(), 'comic', undefined, {})
    expect(hits).toHaveLength(2)
  })

  it('skips deleted words', () => {
    const hits = transcriptFindHits(words, new Set(['a:0']), 'comic', undefined, {})
    expect(hits).toHaveLength(1)
    expect(hits[0].word.id).toBe('a:2')
  })
})
