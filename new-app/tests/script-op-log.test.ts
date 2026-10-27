import { describe, expect, it } from 'vitest'
import {
  applyCompositionOp,
  applyCompositionOps,
  cloneDocument,
  documentsEqual,
  emptyDocument,
  opsBetweenDocuments,
} from '@/lib/clips/script-edl/ops'

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

  it('undo and redo ops persist through JSON reload', () => {
    let doc = emptyDocument(ids)
    const afterA = applyCompositionOp(doc, { type: 'delete_words', wordIds: ['a:0'] })
    const afterB = applyCompositionOp(afterA, { type: 'delete_words', wordIds: ['a:2'] })
    const undoB = applyCompositionOp(afterB, { type: 'restore_words', wordIds: ['a:2'] })
    expect(opsBetweenDocuments(afterB, undoB)).toEqual([{ type: 'restore_words', wordIds: ['a:2'] }])

    const redoB = applyCompositionOp(undoB, { type: 'delete_words', wordIds: ['a:2'] })
    expect(documentsEqual(redoB, afterB)).toBe(true)

    const reloaded = JSON.parse(JSON.stringify(redoB)) as typeof redoB
    expect(documentsEqual(reloaded, afterB)).toBe(true)
    expect(reloaded.deletedWordIds.sort()).toEqual(['a:0', 'a:2'].sort())
  })

  it('patch_settings merges composition prefs', () => {
    let doc = emptyDocument(ids)
    doc = applyCompositionOp(doc, { type: 'patch_settings', patch: { aspect: '16:9', volumePct: 80 } })
    expect(doc.settings?.aspect).toBe('16:9')
    expect(doc.settings?.volumePct).toBe(80)
    doc = applyCompositionOp(doc, {
      type: 'patch_settings',
      patch: { captions: { presetId: 'minimal' } },
    })
    expect(doc.settings?.captions?.presetId).toBe('minimal')
  })

  it('opsBetweenDocuments includes ignore and transcript fields', () => {
    let doc = emptyDocument(ids)
    const ignored = applyCompositionOp(doc, { type: 'ignore_words', wordIds: ['a:1'] })
    const ops = opsBetweenDocuments(ignored, doc)
    expect(ops).toContainEqual({ type: 'restore_ignored', wordIds: ['a:1'] })
    const undone = applyCompositionOps(ignored, ops)
    expect(documentsEqual(undone, doc)).toBe(true)
  })

  it('opsBetweenDocuments matches snapshot undo stack', () => {
    let doc = emptyDocument(ids)
    const stack: ReturnType<typeof cloneDocument>[] = []
    stack.push(cloneDocument(doc))
    doc = applyCompositionOp(doc, { type: 'delete_words', wordIds: ['a:1'] })
    stack.push(cloneDocument(doc))
    doc = applyCompositionOp(doc, { type: 'delete_words', wordIds: ['a:3'] })

    const prev = stack.pop()!
    const ops = opsBetweenDocuments(doc, prev)
    const undone = applyCompositionOps(doc, ops)
    expect(documentsEqual(undone, prev)).toBe(true)
  })
})
