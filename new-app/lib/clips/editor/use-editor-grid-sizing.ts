'use client'

import { useEffect, type RefObject } from 'react'

/** Container-based column widths — fits ~1280–1366 CSS px (incl. ~1093px at 125% zoom on 1366). */
export function applyEditorGridSizing(el: HTMLElement, widthPx: number) {
  const w = Math.max(0, widthPx)
  const tools =
    w < 1040 ? 180 : w < 1180 ? 200 : w < 1320 ? 220 : Math.min(340, Math.max(200, Math.round(w * 0.2)))
  const propsVisible = w >= 1120
  const props = !propsVisible ? 0 : w < 1280 ? 200 : w < 1440 ? 220 : Math.min(300, Math.max(200, Math.round(w * 0.17)))
  el.style.setProperty('--editor-tools-w', `${tools}px`)
  el.style.setProperty('--editor-props-w', props > 0 ? `${props}px` : '0px')
  el.style.setProperty('--editor-props-visible', props > 0 ? 'flex' : 'none')
}

export function useEditorGridSizing(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = el.getBoundingClientRect().width
      if (w > 0) applyEditorGridSizing(el, w)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}
