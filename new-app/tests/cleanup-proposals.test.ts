import { describe, expect, it } from 'vitest'
import {
  classifyCut,
  fillerProposals,
  mergeCleanupCutRanges,
  proposalId,
} from '@/lib/clips/editor/cleanup-proposals'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

const words: EditorWord[] = [
  {
    id: 'w0',
    text: 'um',
    t0Ms: 1000,
    t1Ms: 1200,
    isFiller: true,
    fillerKind: 'lexicon',
  } as EditorWord,
  {
    id: 'w1',
    text: 'hello',
    t0Ms: 2000,
    t1Ms: 2400,
    isFiller: false,
  } as EditorWord,
]

describe('cleanup proposals', () => {
  it('classifies filler cuts', () => {
    const range: [number, number] = [1000, 1200]
    expect(classifyCut(range, words, new Set())).toBe('filler')
    expect(proposalId(range)).toBe('1000:1200')
  })

  it('keeps filler without audio in review, not unsafe Remove All', () => {
    const props = fillerProposals(words, new Set())
    expect(props[0]?.quality?.confidence).toBe('needs_review')
    expect(props[0]?.quality?.reason).toBe('no_audio_envelope')
  })

  it('lists filler proposals', () => {
    const props = fillerProposals(words, new Set())
    expect(props).toHaveLength(1)
    expect(props[0]?.kind).toBe('filler')
  })

  it('merges cut ranges', () => {
    const merged = mergeCleanupCutRanges([], [[1000, 1200]], [])
    expect(merged).toEqual([[1000, 1200]])
  })
})
