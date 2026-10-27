import { describe, expect, it } from 'vitest'
import { applyCompositionOp, applyCompositionOps, emptyDocument } from '@/lib/clips/script-edl/ops'

describe('script op log', () => {
  const ids = ['a:0', 'a:1', 'a:2', 'a:3']

  it('delete and restore preserve word order', () => {
    let doc = emptyDocument(ids)
    doc = applyCompositionOp(doc, { type: 'delete_words', wordIds: ['a:1', 'a:2'] })
    expect(doc.keptWordIds).toEqual(['a:0', 'a:3'])
    doc = applyCompositionOp(doc, { type: 'restore_words', wordIds: ['a:1'] })
    expect(doc.keptWordIds).toEqual(['a:0', 'a:1', 'a:3'])
  })

  it('replays batch idempotently in memory', () => {
    const doc0 = emptyDocument(ids)
    const ops = [
      { type: 'delete_words' as const, wordIds: ['a:0'] },
      { type: 'delete_words' as const, wordIds: ['a:2'] },
    ]
    const once = applyCompositionOps(doc0, ops)
    const twice = applyCompositionOps(applyCompositionOps(doc0, ops.slice(0, 1)), ops.slice(1))
    expect(twice.keptWordIds).toEqual(once.keptWordIds)
    expect(once.keptWordIds).toEqual(['a:1', 'a:3'])
  })
})
