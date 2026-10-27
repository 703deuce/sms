import {
  applyCompositionOps,
  cloneDocument,
  documentsEqual,
  opsBetweenDocuments,
  type ScriptCompositionOp,
} from '@/lib/clips/script-edl/ops'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'

export type CompositionSyncState = {
  revision: number
  document: ScriptDocumentV1
}

export async function fetchCompositionSync(compositionId: string): Promise<CompositionSyncState> {
  const res = await fetch(`/api/clips/compositions/${compositionId}`)
  const json = (await res.json().catch(() => ({}))) as {
    data?: CompositionSyncState
    error?: string
  }
  if (!res.ok) throw new Error(json.error || res.statusText)
  if (!json.data) throw new Error('Missing composition data')
  return json.data
}

export type CompositionOpLog = {
  revision: number
  document: ScriptDocumentV1
  ops: { id: string; revision: number; op: ScriptCompositionOp }[]
}

export async function fetchOpsSince(compositionId: string, sinceRevision: number): Promise<CompositionOpLog> {
  const res = await fetch(`/api/clips/compositions/${compositionId}/ops?sinceRevision=${sinceRevision}`)
  const json = (await res.json().catch(() => ({}))) as {
    data?: CompositionOpLog
    error?: string
  }
  if (!res.ok) throw new Error(json.error || res.statusText)
  if (!json.data) throw new Error('Missing op log')
  return json.data
}

/** After 409: fetch server head (+ op log since local base for diagnostics), diff to local target. */
export async function rebaseAfterStaleRevision(
  compositionId: string,
  localBaseRevision: number,
  targetDoc: ScriptDocumentV1,
): Promise<{ revision: number; document: ScriptDocumentV1; ops: ScriptCompositionOp[] }> {
  const log = await fetchOpsSince(compositionId, localBaseRevision)
  const ops = rebaseOpsForTarget(log.document, targetDoc)
  return { revision: log.revision, document: log.document, ops }
}

/** Rebase local target document onto server revision; returns ops to apply server-side. */
export function rebaseOpsForTarget(
  serverDoc: ScriptDocumentV1,
  targetDoc: ScriptDocumentV1,
): ScriptCompositionOp[] {
  if (documentsEqual(serverDoc, targetDoc)) return []
  return opsBetweenDocuments(serverDoc, targetDoc)
}

export function applyOpsLocally(base: ScriptDocumentV1, ops: ScriptCompositionOp[]): ScriptDocumentV1 {
  return applyCompositionOps(cloneDocument(base), ops)
}
