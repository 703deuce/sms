'use client'

import { useCallback, useRef, useState } from 'react'
import {
  applyCompositionOp,
  cloneDocument,
  documentsEqual,
  opsBetweenDocuments,
  type ScriptCompositionOp,
} from '@/lib/clips/script-edl/ops'
import type { ScriptDocumentV1 } from '@/lib/clips/script-edl/types'
import { clipsFetch } from '@/lib/clips-api'

function newOpId(): string {
  return `op_${crypto.randomUUID().replace(/-/g, '')}`
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

  const bumpStacks = useCallback(() => {
    setUndoDepth(undoStackRef.current.length)
    setRedoDepth(redoStackRef.current.length)
  }, [])

  const enqueueServerOps = useCallback(
    (ops: ScriptCompositionOp[], rollbackDoc: ScriptDocumentV1, onRollback?: () => void) => {
      if (!ops.length) return
      pendingOpsRef.current += 1
      setSaveState('saving')
      queueRef.current = queueRef.current
        .then(async () => {
          for (const op of ops) {
            const opId = newOpId()
            const res = await clipsFetch<{
              revision: number
              document: ScriptDocumentV1
              ackedOpIds: string[]
            }>(`/api/clips/compositions/${initial.compositionId}/ops`, {
              method: 'POST',
              body: JSON.stringify({
                baseRevision: revisionRef.current,
                ops: [{ id: opId, op }],
              }),
            })
            revisionRef.current = res.revision
            setRevision(res.revision)
            if (res.document) setDocument(res.document)
          }
          saveErrorRef.current = false
        })
        .catch(() => {
          saveErrorRef.current = true
          onRollback?.()
          setDocument(rollbackDoc)
          bumpStacks()
          setSaveState('error')
        })
        .finally(() => {
          pendingOpsRef.current = Math.max(0, pendingOpsRef.current - 1)
          if (pendingOpsRef.current === 0) {
            setSaveState(saveErrorRef.current ? 'error' : 'saved')
            if (!saveErrorRef.current) saveErrorRef.current = false
          }
        })
    },
    [bumpStacks, initial.compositionId, setDocument],
  )

  const commitLocal = useCallback(
    (next: ScriptDocumentV1, serverOps: ScriptCompositionOp[], before: ScriptDocumentV1) => {
      undoStackRef.current.push(cloneDocument(before))
      redoStackRef.current = []
      setDocument(next)
      bumpStacks()
      enqueueServerOps(serverOps, before)
    },
    [bumpStacks, enqueueServerOps],
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

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    const current = documentRef.current
    redoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, prev)
    setDocument(prev)
    bumpStacks()
    enqueueServerOps(ops, current, () => {
      undoStackRef.current.push(cloneDocument(prev))
      redoStackRef.current.pop()
    })
  }, [bumpStacks, enqueueServerOps, setDocument])

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    const current = documentRef.current
    undoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, next)
    setDocument(next)
    bumpStacks()
    enqueueServerOps(ops, current, () => {
      redoStackRef.current.push(cloneDocument(next))
      undoStackRef.current.pop()
    })
  }, [bumpStacks, enqueueServerOps, setDocument])

  return {
    document,
    revision,
    saveState,
    deleteWords,
    applyOp,
    undo,
    redo,
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
  }
}
