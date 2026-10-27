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
  const [document, setDocument] = useState<ScriptDocumentV1>(initial.document)
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
    (ops: ScriptCompositionOp[], rollbackDoc: ScriptDocumentV1) => {
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
          }
          saveErrorRef.current = false
        })
        .catch(() => {
          saveErrorRef.current = true
          setDocument(rollbackDoc)
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
    [initial.compositionId],
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

  const deleteWords = useCallback(
    (wordIds: string[]) => {
      const unique = [...new Set(wordIds)].filter(Boolean)
      if (!unique.length) return
      const before = document
      const next = applyCompositionOp(before, { type: 'delete_words', wordIds: unique })
      if (documentsEqual(before, next)) return
      commitLocal(next, [{ type: 'delete_words', wordIds: unique }], before)
    },
    [commitLocal, document],
  )

  const undo = useCallback(() => {
    const prev = undoStackRef.current.pop()
    if (!prev) return
    const current = document
    redoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, prev)
    setDocument(prev)
    bumpStacks()
    enqueueServerOps(ops, current)
  }, [bumpStacks, document, enqueueServerOps])

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop()
    if (!next) return
    const current = document
    undoStackRef.current.push(cloneDocument(current))
    const ops = opsBetweenDocuments(current, next)
    setDocument(next)
    bumpStacks()
    enqueueServerOps(ops, current)
  }, [bumpStacks, document, enqueueServerOps])

  return {
    document,
    revision,
    saveState,
    deleteWords,
    undo,
    redo,
    canUndo: undoDepth > 0,
    canRedo: redoDepth > 0,
  }
}
