'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const MAX = 50
const STORAGE_PREFIX = 't2v-undo:'

type StackState = {
  baseRevision: number
  past: T2vDraftV1[]
  future: T2vDraftV1[]
}

function loadStack(draftId: string, serverRevision: number): Pick<StackState, 'past' | 'future'> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${draftId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StackState
    if (parsed.baseRevision !== serverRevision) return null
    return {
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
        baseRevision: state.baseRevision,
        past: state.past.slice(-MAX),
        future: state.future.slice(0, MAX),
      }),
    )
  } catch {
    /* quota */
  }
}

export function useT2vUndo(
  draftId: string,
  initial: T2vDraftV1,
  serverRevision: number,
  onPersist: (next: T2vDraftV1) => void,
) {
  const hydrated = useRef(false)
  const revisionRef = useRef(serverRevision)
  const [doc, setDoc] = useState(initial)
  const [past, setPast] = useState<T2vDraftV1[]>([])
  const [future, setFuture] = useState<T2vDraftV1[]>([])

  useEffect(() => {
    revisionRef.current = serverRevision
  }, [serverRevision])

  useEffect(() => {
    setDoc(initial)
  }, [initial])

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true
    const stored = loadStack(draftId, serverRevision)
    if (stored) {
      setPast(stored.past)
      setFuture(stored.future)
    }
  }, [draftId, serverRevision])

  useEffect(() => {
    if (!hydrated.current) return
    saveStack(draftId, { baseRevision: revisionRef.current, past, future })
  }, [draftId, past, future])

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
      onPersist(prev)
      return p.slice(0, -1)
    })
  }, [doc, onPersist])

  const redo = useCallback(() => {
    setFuture((f) => {
      if (!f.length) return f
      const [next, ...rest] = f
      setPast((p) => [...p, doc].slice(-MAX))
      setDoc(next)
      onPersist(next)
      return rest
    })
  }, [doc, onPersist])

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
