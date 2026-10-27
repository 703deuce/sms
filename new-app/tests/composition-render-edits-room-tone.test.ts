import { describe, expect, it } from 'vitest'
import { clipEditsFromScriptDocument } from '@/lib/clips/script-editor/composition-render-edits'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

describe('clipEditsFromScriptDocument room tone + clarity', () => {
  it('sets roomTone on export edits', () => {
    const doc: ScriptDocumentV1 = {
      v: 1,
      keptWordIds: ['a:0'],
      deletedWordIds: [],
      audioFx: { roomTone: true },
    }
    const edits = clipEditsFromScriptDocument(doc, { trimInMs: 0, trimOutMs: 5000, cutRanges: [] })
    expect(edits.roomTone).toBe(true)
  })

  it('maps wordTextOverrides to wordFixes', () => {
    const doc: ScriptDocumentV1 = {
      v: 1,
      keptWordIds: ['media:12'],
      deletedWordIds: [],
      wordTextOverrides: { 'media:12': 'hello' },
    }
    const edits = clipEditsFromScriptDocument(doc, { trimInMs: 0, trimOutMs: 5000, cutRanges: [] })
    expect(edits.wordFixes['12']).toBe('hello')
  })
})
