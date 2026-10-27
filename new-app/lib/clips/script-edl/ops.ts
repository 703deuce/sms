import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type DeleteWordsOp = { type: 'delete_words'; wordIds: string[] }
export type RestoreWordsOp = { type: 'restore_words'; wordIds: string[] }
export type AddSplitOp = { type: 'add_split'; outMs: number }
export type InsertGapOp = { type: 'insert_gap'; atOutMs: number; durMs: number }
export type RemoveGapOp = { type: 'remove_gap_at'; atOutMs: number }
export type ReplaceWithGapOp = { type: 'replace_with_gap'; wordIds: string[]; atOutMs: number; durMs: number }
export type SetPadBeforeOp = { type: 'set_pad_before'; wordId: string; padMs: number }

export type ScriptCompositionOp =
  | DeleteWordsOp
  | RestoreWordsOp
  | AddSplitOp
  | InsertGapOp
  | RemoveGapOp
  | ReplaceWithGapOp
  | SetPadBeforeOp

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
  let gapInserts = document.gapInserts ? [...document.gapInserts] : undefined
  let splitAtOutMs = document.splitAtOutMs ? [...document.splitAtOutMs] : undefined
  let padBeforeMs = document.padBeforeMs ? { ...document.padBeforeMs } : undefined

  if (op.type === 'delete_words') {
    for (const id of op.wordIds) {
      kept.delete(id)
      deleted.add(id)
    }
  } else if (op.type === 'restore_words') {
    for (const id of op.wordIds) {
      deleted.delete(id)
      kept.add(id)
    }
  } else if (op.type === 'add_split') {
    const ms = Math.max(0, Math.round(op.outMs))
    splitAtOutMs = splitAtOutMs ?? []
    if (!splitAtOutMs.some((x) => Math.abs(x - ms) < 2)) {
      splitAtOutMs.push(ms)
      splitAtOutMs.sort((a, b) => a - b)
    }
  } else if (op.type === 'insert_gap') {
    gapInserts = gapInserts ?? []
    gapInserts.push({ atOutMs: Math.max(0, Math.round(op.atOutMs)), durMs: Math.max(1, Math.round(op.durMs)) })
  } else if (op.type === 'remove_gap_at') {
    const at = Math.round(op.atOutMs)
    gapInserts = (gapInserts ?? []).filter((g) => typeof g.atOutMs !== 'number' || Math.abs(g.atOutMs - at) > 2)
  } else if (op.type === 'replace_with_gap') {
    for (const id of op.wordIds) {
      kept.delete(id)
      deleted.add(id)
    }
    gapInserts = gapInserts ?? []
    gapInserts.push({
      atOutMs: Math.max(0, Math.round(op.atOutMs)),
      durMs: Math.max(1, Math.round(op.durMs)),
    })
  } else if (op.type === 'set_pad_before') {
    padBeforeMs = padBeforeMs ?? {}
    padBeforeMs[op.wordId] = Math.max(0, Math.round(op.padMs))
  }

  const keptWordIds = order.filter((id) => kept.has(id))
  return {
    v: 1,
    keptWordIds,
    deletedWordIds: [...deleted],
    wordOrder: order,
    gapInserts,
    splitAtOutMs,
    padBeforeMs,
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

  const fromSplits = (from.splitAtOutMs ?? []).join(',')
  const toSplits = (to.splitAtOutMs ?? []).join(',')
  if (fromSplits !== toSplits) {
    for (const ms of to.splitAtOutMs ?? []) {
      if (!(from.splitAtOutMs ?? []).some((x) => Math.abs(x - ms) < 2)) {
        ops.push({ type: 'add_split', outMs: ms })
      }
    }
  }

  const gapKey = (g: { afterWordId?: string; atOutMs?: number; durMs: number }) =>
    `${g.afterWordId ?? ''}:${g.atOutMs ?? ''}:${g.durMs}`
  const fromGaps = new Set((from.gapInserts ?? []).map(gapKey))
  const toGaps = to.gapInserts ?? []
  for (const g of toGaps) {
    if (!fromGaps.has(gapKey(g)) && typeof g.atOutMs === 'number') {
      ops.push({ type: 'insert_gap', atOutMs: g.atOutMs, durMs: g.durMs })
    }
  }
  for (const g of from.gapInserts ?? []) {
    if (!toGaps.some((t) => gapKey(t) === gapKey(g)) && typeof g.atOutMs === 'number') {
      ops.push({ type: 'remove_gap_at', atOutMs: g.atOutMs })
    }
  }

  const fromPad = from.padBeforeMs ?? {}
  const toPad = to.padBeforeMs ?? {}
  for (const wordId of Object.keys(toPad)) {
    if (fromPad[wordId] !== toPad[wordId]) {
      ops.push({ type: 'set_pad_before', wordId, padMs: toPad[wordId] })
    }
  }

  return ops
}

export function documentsEqual(a: ScriptDocumentV1, b: ScriptDocumentV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
