'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const MAX = 50
const STORAGE_PREFIX = 't2v-undo:'

type StackState = {
  doc: T2vDraftV1
  past: T2vDraftV1[]
  future: T2vDraftV1[]
}

function loadStack(draftId: string, fallback: T2vDraftV1): StackState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${draftId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StackState
    if (!parsed?.doc || parsed.doc.v !== 1) return null
    return {
      doc: parsed.doc,
      past: Array.isArray(parsed.past) ? parsed.past.slice(-MAX) : [],
      future: Array.isArray(parsed.future) ? parsed.future.slice(0, MAX) : [],
    }
  } catch {
    return null
  }
}

function saveStack(draftId: string, state: StackState) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${draftId}`,
      JSON.stringify({
        doc: state.doc,
        past: state.past.slice(-MAX),
        future: state.future.slice(0, MAX),
      }),
    )
  } catch {
    /* quota */
  }
}

export function useT2vUndo(draftId: string, initial: T2vDraftV1) {
  const hydrated = useRef(false)
  const [doc, setDoc] = useState(initial)
  const [past, setPast] = useState<T2vDraftV1[]>([])
  const [future, setFuture] = useState<T2vDraftV1[]>([])

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const stored = loadStack(draftId, initial)
    if (stored) {
      setDoc(stored.doc)
      setPast(stored.past)
      setFuture(stored.future)
    }
  }, [draftId, initial])

  useEffect(() => {
    if (!hydrated.current) return
    saveStack(draftId, { doc, past, future })
  }, [draftId, doc, past, future])

  const push = useCallback(
    (next: T2vDraftV1) => {
      setPast((p) => [...p.slice(-MAX + 1), doc])
      setFuture([])
      setDoc(next)
    },
    [doc],
  )

  const replace = useCallback((next: T2vDraftV1) => {
    setDoc(next)
  }, [])

  const undo = useCallback(() => {
    setPast((p) => {
      if (!p.length) return p
      const prev = p[p.length - 1]
      setFuture((f) => [doc, ...f].slice(0, MAX))
      setDoc(prev)
      return p.slice(0, -1)
    })
  }, [doc])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const [next, ...rest] = f
      setPast((p) => [...p, doc].slice(-MAX))
      setDoc(next)
      return rest
    })
  }, [doc])

  return {
    doc,
    push,
    replace,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
  }
}
