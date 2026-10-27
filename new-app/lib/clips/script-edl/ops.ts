import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type DeleteWordsOp = { type: 'delete_words'; wordIds: string[] }
export type RestoreWordsOp = { type: 'restore_words'; wordIds: string[] }
export type ScriptCompositionOp = DeleteWordsOp | RestoreWordsOp

export function emptyDocument(allWordIds: string[]): ScriptDocumentV1 {
  return { v: 1, keptWordIds: [...allWordIds], deletedWordIds: [], wordOrder: [...allWordIds] }
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
