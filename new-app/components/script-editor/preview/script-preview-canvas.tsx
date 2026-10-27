'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import type { ScriptAspect } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

function aspectParts(aspect: ScriptAspect): { aw: number; ah: number } {
  switch (aspect) {
    case '16:9':
      return { aw: 16, ah: 9 }
    case '1:1':
      return { aw: 1, ah: 1 }
    case '4:5':
      return { aw: 4, ah: 5 }
    default:
      return { aw: 9, ah: 16 }
  }
}

/** Letterboxed preview frame with non-zero size inside flex parents (aspect-ratio alone can collapse to 0×0). */
export function ScriptPreviewCanvas({
  aspect,
  className,
  children,
  boxRef,
}: {
  aspect: ScriptAspect
  className?: string
  children: React.ReactNode
  boxRef?: React.RefObject<HTMLDivElement | null>
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ w: 0, h: 0 })
  const [box, setBox] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width: W, height: H } = entry.contentRect
      if (W <= 0 || H <= 0) return
      const { aw, ah } = aspectParts(aspect)
      const h = Math.floor(Math.min(H, (W * ah) / aw))
      if (h <= 0) return
      const w = Math.floor((h * aw) / ah)
      const prev = sizeRef.current
      if (prev.w === w && prev.h === h) return
      sizeRef.current = { w, h }
      setBox({ w, h })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [aspect])

  useLayoutEffect(() => {
    if (boxRef && innerRef.current) {
      ;(boxRef as React.MutableRefObject<HTMLDivElement | null>).current = innerRef.current
    }
  }, [boxRef, box.w, box.h])

  return (
    <div ref={wrapRef} className={cn('flex size-full min-h-0 items-center justify-center', className)}>
      <div
        ref={innerRef}
        className="relative overflow-hidden rounded-xl bg-black shadow-md ring-1 ring-white/10"
        style={{
          width: box.w > 0 ? box.w : undefined,
          height: box.h > 0 ? box.h : undefined,
          minWidth: box.w > 0 ? box.w : 120,
          minHeight: box.h > 0 ? box.h : 120,
        }}
        data-testid="script-preview-canvas"
      >
        {children}
      </div>
    </div>
  )
}
