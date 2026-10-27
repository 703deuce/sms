'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  applyCompositionOp,
  cloneDocument,
  documentsEqual,
  opsBetweenDocuments,
  type ScriptCompositionOp,
} from '@/lib/clips/script-edl/ops'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import {
  fetchCompositionSync,
  rebaseOpsForTarget,
} from '@/lib/clips/script-editor/composition-sync'
import {
  clearPersistedUndo,
  loadPersistedUndo,
  savePersistedUndo,
} from '@/lib/clips/script-editor/composition-undo-persistence'

function newOpId(): string {
  return `op_${crypto.randomUUID().replace(/-/g, '')}`
}

type OpPayload = { id: string; op: ScriptCompositionOp }

async function postOpBatch(
  compositionId: string,
  baseRevision: number,
  ops: OpPayload[],
  targetDoc: ScriptDocumentV1,
): Promise<{ revision: number; document: ScriptDocumentV1; ackedOpIds: string[] }> {
  let revision = baseRevision
  let pending = ops
  let target = targetDoc

  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`/api/clips/compositions/${compositionId}/ops`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseRevision: revision, ops: pending }),
    })
    const json = (await res.json().catch(() => ({}))) as {
      data?: { revision: number; document: ScriptDocumentV1; ackedOpIds: string[] }
      error?: string
      revision?: number
    }

    if (res.ok && json.data) {
      return json.data
    }

    if (res.status === 409) {
      const sync = await fetchCompositionSync(compositionId)
      revision = sync.revision
      const rebased = rebaseOpsForTarget(sync.document, target)
      if (!rebased.length) {
        if (documentsEqual(sync.document, target)) {
          return { revision: sync.revision, document: sync.document, ackedOpIds: [] }
        }
        pending = opsBetweenDocuments(sync.document, target).map((op) => ({
          id: newOpId(),
          op,
        }))
      } else {
        pending = rebased.map((op) => ({ id: newOpId(), op }))
      }
      continue
    }

    throw new Error(json.error || res.statusText)
  }
  throw new Error('Save failed after revision retries')
}

export function useScriptComposition(initial: {
  compositionId: string
  revision: number
  document: ScriptDocumentV1
}) {
  const [document, setDocumentState] = useState<ScriptDocumentV1>(initial.document)
  const documentRef = useRef<ScriptDocumentV1>(initial.document)
  const setDocument = useCallback((next: ScriptDocumentV1) => {
    documentRef.current = next
    setDocumentState(next)
  }, [])
  const [revision, setRevision] = useState(initial.revision)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error'>('saved')
  const [undoDepth, setUndoDepth] = useState(0)
  const [redoDepth, setRedoDepth] = useState(0)

  const revisionRef = useRef(initial.revision)
  const undoStackRef = useRef<ScriptDocumentV1[]>([])
  const redoStackRef = useRef<ScriptDocumentV1[]>([])
  const pendingOpsRef = useRef(0)
  const saveErrorRef = useRef(false)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const localEpochRef = useRef(0)
  const inFlightRef = useRef(false)

  const bumpStacks = useCallback(() => {
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
    savePersistedUndo(
      initial.compositionId,
      revisionRef.current,
      undoStackRef.current,
      redoStackRef.current,
      documentRef.current,
    )
  }, [initial.compositionId])

  useEffect(() => {
    const persisted = loadPersistedUndo(initial.compositionId)
    if (!persisted) return
    if (persisted.revision < revisionRef.current) {
      clearPersistedUndo(initial.compositionId)
      return
    }
    if (persisted.revision !== revisionRef.current) {
      if (persisted.revision > revisionRef.current) clearPersistedUndo(initial.compositionId)
      return
    }
    if (persisted.undo.length) undoStackRef.current = persisted.undo.map(cloneDocument)
    if (persisted.redo.length) redoStackRef.current = persisted.redo.map(cloneDocument)
    bumpStacks()
  }, [initial.compositionId, bumpStacks])

  const enqueueServerOps = useCallback(
    (ops: ScriptCompositionOp[], targetDoc: ScriptDocumentV1, onHardFail?: () => void) => {
      if (!ops.length) return
      const epochAtEnqueue = localEpochRef.current
      pendingOpsRef.current += 1
      setSaveState('saving')
      queueRef.current = queueRef.current
        .then(async () => {
          if (inFlightRef.current) {
            await new Promise<void>((r) => {
              const tick = () => {
                if (!inFlightRef.current) r()
                else setTimeout(tick, 16)
              }
              tick()
            })
          }
          inFlightRef.current = true
          try {
            const payloadOps = ops.map((op) => ({ id: newOpId(), op }))
            const res = await postOpBatch(
              initial.compositionId,
              revisionRef.current,
              payloadOps,
              targetDoc,
            )
            if (epochAtEnqueue !== localEpochRef.current) return
            revisionRef.current = res.revision
            setRevision(res.revision)
            if (res.document && !documentsEqual(res.document, documentRef.current)) {
              setDocument(res.document)
            }
            saveErrorRef.current = false
            savePersistedUndo(
              initial.compositionId,
              res.revision,
              undoStackRef.current,
              redoStackRef.current,
              documentRef.current,
            )
          } catch {
            if (epochAtEnqueue !== localEpochRef.current) return
            saveErrorRef.current = true
            onHardFail?.()
            setSaveState('error')
          } finally {
            inFlightRef.current = false
          }
        })
        .finally(() => {
          pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1)
          if (pendingOpsRef.current === 0 && !saveErrorRef.current) {
            setSaveState('saved')
          }
        })
    },
    [initial.compositionId, setDocument],
  )

  const commitLocal = useCallback(
    (next: ScriptDocumentV1, serverOps: ScriptCompositionOp[], before: ScriptDocumentV1) => {
      localEpochRef.current += 1
      undoStackRef.current.push(cloneDocument(before))
      redoStackRef.current = []
      setDocument(next)
      bumpStacks()
      enqueueServerOps(serverOps, next, () => {
        setDocument(before)
        bumpStacks()
      })
    },
    [bumpStacks, enqueueServerOps, setDocument],
  )

  const applyOp = useCallback(
    (op: ScriptCompositionOp) => {
      const before = documentRef.current
      const next = applyCompositionOp(before, op)
      if (documentsEqual(before, next)) return
      commitLocal(next, [op], before)
    },
    [commitLocal],
  )

  const deleteWords = useCallback(
    (wordIds: string[]) => {
      const unique = [...new Set(wordIds)].filter(Boolean)
      if (!unique.length) return
      applyOp({ type: 'delete_words', wordIds: unique })
    },
    [applyOp],
  )

  const restoreWords = useCallback(
    (wordIds: string[]) => {
      const unique = [...new Set(wordIds)].filter(Boolean)
      if (!unique.length) return
      applyOp({ type: 'restore_words', wordIds: unique })
    },
    [applyOp],
  )

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    localEpochRef.current += 1
    const current = documentRef.current
    redoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, prev)
    setDocument(prev)
    bumpStacks()
    enqueueServerOps(ops, prev, () => {
      undoStackRef.current.push(cloneDocument(prev))
      redoStackRef.current.pop()
      setDocument(current)
      bumpStacks()
    })
  }, [bumpStacks, enqueueServerOps, setDocument])

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    localEpochRef.current += 1
    const current = documentRef.current
    undoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, next)
    setDocument(next)
    bumpStacks()
    enqueueServerOps(ops, next, () => {
      redoStackRef.current.push(cloneDocument(next))
      undoStackRef.current.pop()
      setDocument(current)
      bumpStacks()
    })
  }, [bumpStacks, enqueueServerOps, setDocument])

  const replaceFromServer = useCallback(
    (next: ScriptDocumentV1, nextRevision: number) => {
      localEpochRef.current += 1
      revisionRef.current = nextRevision
      setRevision(nextRevision)
      setDocument(next)
      undoStackRef.current = []
      redoStackRef.current = []
      bumpStacks()
      setSaveState('saved')
    },
    [bumpStacks, setDocument],
  )

  return {
    document,
    revision,
    saveState,
    deleteWords,
    restoreWords,
    applyOp,
    undo,
    redo,
    replaceFromServer,
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
  }
}

/** Test harness for undo/redo without React (keyboard + button parity). */
export function runCompositionUndoRedoScenario(
  initialDoc: ScriptDocumentV1,
  steps: Array<'undo' | 'redo' | { delete: string[] } | { restore: string[] }>,
): ScriptDocumentV1 {
  let doc = cloneDocument(initialDoc)
  const undo: ScriptDocumentV1[] = []
  const redo: ScriptDocumentV1[] = []

  for (const step of steps) {
    if (step === 'undo') {
      const prev = undo.pop()
      if (!prev) continue
      redo.push(cloneDocument(doc))
      doc = cloneDocument(prev)
      continue
    }
    if (step === 'redo') {
      const next = redo.pop()
      if (!next) continue
      undo.push(cloneDocument(doc))
      doc = cloneDocument(next)
      continue
    }
    const before = cloneDocument(doc)
    const op =
      'delete' in step
        ? ({ type: 'delete_words', wordIds: step.delete } as ScriptCompositionOp)
        : ({ type: 'restore_words', wordIds: step.restore } as ScriptCompositionOp)
    const next = applyCompositionOp(doc, op)
    if (documentsEqual(before, next)) continue
    undo.push(before)
    redo.length = 0
    doc = next
  }
  return doc
}
