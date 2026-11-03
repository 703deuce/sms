'use client'

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'transovo.editor.scriptSplitPct'
export const SCRIPT_SPLIT_DEFAULT = 0.55
const MIN = 0.35
const MAX = 0.75

export function clampScriptSplitPct(n: number): number {
  if (!Number.isFinite(n)) return SCRIPT_SPLIT_DEFAULT
  return Math.min(MAX, Math.max(MIN, n))
}

export function readScriptSplitPct(): number {
  if (typeof window === 'undefined') return SCRIPT_SPLIT_DEFAULT
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw != null) return clampScriptSplitPct(Number.parseFloat(raw))
  } catch {
    /* private mode */
  }
  return SCRIPT_SPLIT_DEFAULT
}

export function useScriptViewSplit() {
  const [transcriptPct, setTranscriptPct] = useState(SCRIPT_SPLIT_DEFAULT)

  useEffect(() => {
    setTranscriptPct(readScriptSplitPct())
  }, [])

  const persist = useCallback((next: number) => {
    const clamped = clampScriptSplitPct(next)
    setTranscriptPct(clamped)
    try {
      localStorage.setItem(LS_KEY, String(clamped))
    } catch {
      /* private mode */
    }
  }, [])

  return { transcriptPct, persist, minPct: MIN, maxPct: MAX }
}
