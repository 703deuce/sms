'use client'

import { useCallback, useState } from 'react'
import type { T2vDraftV1 } from '@/lib/t2v/types'

const MAX = 50

export function useT2vUndo(initial: T2vDraftV1) {
  const [doc, setDoc] = useState(initial)
  const [past, setPast] = useState<T2vDraftV1[]>([])
  const [future, setFuture] = useState<T2vDraftV1[]>([])

  const push = useCallback((next: T2vDraftV1) => {
    setPast((p) => [...p.slice(-MAX + 1), doc])
    setFuture([])
    setDoc(next)
  }, [doc])

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
