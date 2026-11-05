import { describe, expect, it } from 'vitest'
import { brollInsertWindow, BROLL_MIN_MS } from '@/lib/clips/broll'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { findMatches, replacementFixes } from '@/lib/clips/editor/find-replace'
import { sourceWordsForClipEditing } from '@/lib/clips/editor/clip-editor-word-scope'

describe('Full editor suite Batch 5', () => {
  it('F18 a one-word clip never expands into every project word', () => {
    const words = [{i:0,w:'Right.',s:0,e:0.7},{i:1,w:'And,',s:8,e:8.4}]
    const edits = defaultEdits({clipStartMs:0,clipEndMs:1000})
    expect(sourceWordsForClipEditing(words,edits,{clipStartMs:0,clipEndMs:1000}).map(w=>w.w)).toEqual(['Right.'])
  })
  it('F23 places end-playhead stock footage within the clip with non-zero duration', () => {
    expect(brollInsertWindow(31000,31000)).toEqual({startMs:28000,endMs:31000})
    expect(brollInsertWindow(999,1000)).toEqual({startMs:0,endMs:1000})
    expect(brollInsertWindow(0,999)).toEqual({startMs:0,endMs:0})
    expect(brollInsertWindow(1500,2500).endMs - brollInsertWindow(1500,2500).startMs).toBeGreaterThanOrEqual(BROLL_MIN_MS)
  })

  it('F22 find-replace keeps punctuation when replacing a word at a line boundary', () => {
    const words = [
      { i: 0, w: 'learning.', s: 0, e: 0.5 },
      { i: 1, w: 'And,', s: 0.6, e: 0.9 },
    ]
    const edits = normalizeEdits(defaultEdits({clipStartMs:0,clipEndMs:1000}), {clipStartMs:0,clipEndMs:1000})
    const match = findMatches(words,edits,'learning')[0]
    expect(match).toBeDefined()
    expect(replacementFixes(words,match!,'teaching').fixes['0']).toBe('teaching.')
  })
})
