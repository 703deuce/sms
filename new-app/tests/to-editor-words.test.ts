import { describe, expect, it } from 'vitest'
import type { ClipWord } from '@/lib/clips/edits'
import { defaultSpeakerColor, resolveSourceMediaId, toEditorWords } from '@/lib/clips/script-editor/to-editor-words'

describe('toEditorWords', () => {
  it('assigns stable ids from sourceMediaId and index', () => {
    const words = toEditorWords('clip_upload:upl_1', [
      { w: 'Hello', s: 0, e: 0.5, i: 3 },
      { w: 'world', s: 0.5, e: 1.0, i: 4, spk: 1, isFiller: true, fillerKind: 'lexicon' } as ClipWord &
        Record<string, unknown>,
    ])
    expect(words[0].id).toBe('clip_upload:upl_1:3')
    expect(words[0].t0Ms).toBe(0)
    expect(words[0].speakerId).toBe('spk:0')
    expect(words[1].id).toBe('clip_upload:upl_1:4')
    expect(words[1].isFiller).toBe(true)
    expect(words[1].fillerKind).toBe('lexicon')
  })

  it('resolves source media id', () => {
    expect(resolveSourceMediaId({ id: 'proj_1', uploadId: 'upl_x' })).toBe('clip_upload:upl_x')
    expect(resolveSourceMediaId({ id: 'proj_1', uploadId: null })).toBe('import:proj_1')
  })

  it('cycles speaker colors', () => {
    expect(defaultSpeakerColor(0)).toMatch(/^#/)
    expect(defaultSpeakerColor(4)).toBe(defaultSpeakerColor(0))
  })
})
