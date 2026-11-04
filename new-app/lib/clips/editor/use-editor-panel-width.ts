'use client'

import { useCallback, useEffect, useState } from 'react'

const LS_KEY = 'transovo.editor.panelWidthPx.v2'
const DEFAULT_PX = 320
const MIN_PX = 280

export function readEditorPanelWidthPx(): number {
  if (typeof window === 'undefined') return DEFAULT_PX
  try {
    const n = Number.parseInt(localStorage.getItem(LS_KEY) ?? '', 10)
    if (Number.isFinite(n) && n >= MIN_PX) return n
  } catch {
    /* private mode */
  }
  return DEFAULT_PX
}

export function maxEditorPanelWidthPx(): number {
  if (typeof window === 'undefined') return 720
  return Math.max(MIN_PX, Math.floor(window.innerWidth * 0.5))
}

export function useEditorPanelWidth() {
  const [widthPx, setWidthPx] = useState(DEFAULT_PX)

  useEffect(() => {
    setWidthPx(readEditorPanelWidthPx())
  }, [])

  const persist = useCallback((next: number) => {
    const max = maxEditorPanelWidthPx()
    const clamped = Math.min(max, Math.max(MIN_PX, Math.round(next)))
    setWidthPx(clamped)
    try {
      localStorage.setItem(LS_KEY, String(clamped))
    } catch {
      /* private mode */
    }
  }, [])

  return { widthPx, persist, minPx: MIN_PX, maxPx: maxEditorPanelWidthPx() }
}
