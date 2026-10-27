import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type DeleteWordsOp = { type: 'delete_words'; wordIds: string[] }
export type RestoreWordsOp = { type: 'restore_words'; wordIds: string[] }
export type ScriptCompositionOp = DeleteWordsOp | RestoreWordsOp

export function emptyDocument(allWordIds: string[]): ScriptDocumentV1 {
  return { v: 1, keptWordIds: [...allWordIds], deletedWordIds: [], wordOrder: [...allWordIds] }
}

export function cloneDocument(document: ScriptDocumentV1): ScriptDocumentV1 {
  return JSON.parse(JSON.stringify(document)) as ScriptDocumentV1
}

function wordOrderOf(document: ScriptDocumentV1): string[] {
  if (document.wordOrder?.length) return document.wordOrder
  return [...document.keptWordIds, ...document.deletedWordIds]
}

export function applyCompositionOp(document: ScriptDocumentV1, op: ScriptCompositionOp): ScriptDocumentV1 {
  const order = wordOrderOf(document)
  const deleted = new Set(document.deletedWordIds)
  const kept = new Set(document.keptWordIds)

  if (op.type === 'delete_words') {
    for (const id of op.wordIds) {
      kept.delete(id)
      deleted.add(id)
    }
  } else {
    for (const id of op.wordIds) {
      deleted.delete(id)
      kept.add(id)
    }
  }

  const keptWordIds = order.filter((id) => kept.has(id))
  return {
    v: 1,
    keptWordIds,
    deletedWordIds: [...deleted],
    wordOrder: order,
    gapInserts: document.gapInserts,
  }
}

export function applyCompositionOps(document: ScriptDocumentV1, ops: ScriptCompositionOp[]): ScriptDocumentV1 {
  return ops.reduce((doc, op) => applyCompositionOp(doc, op), document)
}

/** Ops to transform `from` document into `to` (for undo/redo server sync). */
export function opsBetweenDocuments(from: ScriptDocumentV1, to: ScriptDocumentV1): ScriptCompositionOp[] {
  const fromDel = new Set(from.deletedWordIds)
  const toDel = new Set(to.deletedWordIds)
  const restoreIds = [...fromDel].filter((id) => !toDel.has(id))
  const deleteIds = [...toDel].filter((id) => !fromDel.has(id))
  const ops: ScriptCompositionOp[] = []
  if (restoreIds.length) ops.push({ type: 'restore_words', wordIds: restoreIds })
  if (deleteIds.length) ops.push({ type: 'delete_words', wordIds: deleteIds })
  return ops
}

export function documentsEqual(a: ScriptDocumentV1, b: ScriptDocumentV1): boolean {
  return (
    a.keptWordIds.join('\0') === b.keptWordIds.join('\0') &&
    [...a.deletedWordIds].sort().join('\0') === [...b.deletedWordIds].sort().join('\0')
  )
}
