'use client'

import { useCallback, useEffect, useState, type RefObject } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { clampTimelineHeight, readTimelineHeight, writeTimelineHeight } from '@/lib/clips/editor/timeline-opts'

export const EDITOR_SCRIPT_TIMELINE_ROW_PX = 168

export function useEditorTimelineRow(
  gridRef: RefObject<HTMLElement | null>,
  mode: 'timeline-dock' | 'script' | 'default',
) {
  const [rowPx, setRowPx] = useState<number>(() =>
    mode === 'script' ? EDITOR_SCRIPT_TIMELINE_ROW_PX : 280,
  )

  const applyRow = useCallback(
    (h: number) => {
      const vh = typeof window === 'undefined' ? 900 : window.innerHeight
      const next =
        mode === 'script'
          ? EDITOR_SCRIPT_TIMELINE_ROW_PX
          : clampTimelineHeight(h, vh)
      setRowPx(next)
      const el = gridRef.current
      if (el) el.style.setProperty('--editor-timeline-row-h', `${next}px`)
      if (mode !== 'script') writeTimelineHeight(next)
    },
    [gridRef, mode],
  )

  useEffect(() => {
    if (mode === 'script') {
      applyRow(EDITOR_SCRIPT_TIMELINE_ROW_PX)
      return
    }
    const vh = typeof window === 'undefined' ? 900 : window.innerHeight
    const stored = readTimelineHeight()
    applyRow(stored ?? Math.round(vh * 0.3))
  }, [applyRow, mode])

  useEffect(() => {
    if (mode === 'script') return
    const onResize = () => {
      setRowPx((h) => clampTimelineHeight(h, window.innerHeight))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode])

  const onRowResizePointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (mode === 'script') return
      e.preventDefault()
      const y0 = e.clientY
      const h0 = rowPx
      const mv = (ev: PointerEvent) => applyRow(h0 - (ev.clientY - y0))
      const up = () => {
        window.removeEventListener('pointermove', mv)
        window.removeEventListener('pointerup', up)
      }
      window.addEventListener('pointermove', mv)
      window.addEventListener('pointerup', up)
    },
    [applyRow, mode, rowPx],
  )

  return { rowPx, onRowResizePointerDown, mode }
}
