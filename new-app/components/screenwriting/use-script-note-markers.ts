'use client'

import { useEffect } from 'react'
import type { ScriptNoteThread } from '@/components/screenwriting/script-notes-column'

/** Position margin markers by element `data-id` offset inside the editor scroll container. */
export function useScriptNoteMarkerPositions(
  containerRef: React.RefObject<HTMLElement | null>,
  threads: ScriptNoteThread[],
) {
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    for (const t of threads) {
      const el = root.querySelector(`[data-id="${t.elementId}"]`)
      if (!el) continue
      const top = (el as HTMLElement).offsetTop
      root.style.setProperty(`--marker-top-${t.elementId}`, `${top}px`)
    }
  }, [containerRef, threads])
}
