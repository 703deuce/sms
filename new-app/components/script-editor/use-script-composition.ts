'use client'

import { useCallback, useState } from 'react'
import { applyCompositionOp } from '@/lib/clips/script-edl/ops'
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
  const [undoDoc, setUndoDoc] = useState<ScriptDocumentV1 | null>(null)

  const postOp = useCallback(
    async (op: { type: 'delete_words'; wordIds: string[] } | { type: 'restore_words'; wordIds: string[] }, base: ScriptDocumentV1) => {
      setSaveState('saving')
      const opId = newOpId()
      try {
        const res = await clipsFetch<{
          revision: number
          document: ScriptDocumentV1
          ackedOpIds: string[]
        }>(`/api/clips/compositions/${initial.compositionId}/ops`, {
          method: 'POST',
          body: JSON.stringify({
            baseRevision: revision,
            ops: [{ id: opId, op }],
          }),
        })
        setRevision(res.revision)
        setDocument(res.document)
        setSaveState('saved')
        return true
      } catch {
        setDocument(base)
        setSaveState('error')
        return false
      }
    },
    [initial.compositionId, revision],
  )

  const deleteWords = useCallback(
    (wordIds: string[]) => {
      if (!wordIds.length) return
      setUndoDoc(document)
      const next = applyCompositionOp(document, { type: 'delete_words', wordIds })
      setDocument(next)
      void postOp({ type: 'delete_words', wordIds }, document)
    },
    [document, postOp],
  )

  const undo = useCallback(() => {
    if (!undoDoc) return
    const toRestore = document.deletedWordIds.filter((id) => !undoDoc.deletedWordIds.includes(id))
    if (!toRestore.length) {
      setDocument(undoDoc)
      setUndoDoc(null)
      return
    }
    const base = document
    setDocument(undoDoc)
    setUndoDoc(null)
    void postOp({ type: 'restore_words', wordIds: toRestore }, base)
  }, [document, postOp, undoDoc])

  return { document, revision, saveState, deleteWords, undo, canUndo: Boolean(undoDoc) }
}
