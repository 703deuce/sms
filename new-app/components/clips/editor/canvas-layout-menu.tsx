'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clampMenuPosition } from '@/lib/clips/editor/menu-position'

/**
 * FIX2 R4: right-click layout menu, portaled to <body> and position:fixed at the cursor, so the
 * overflow-hidden / container-type preview frame can no longer clip it. Clamped to the viewport; scrolls
 * when taller than the viewport.
 */
export function CanvasLayoutMenu({
  x,
  y,
  onClose,
  children,
}: {
  /** viewport (client) coordinates of the right-click */
  x: number
  y: number
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: x, top: y })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos(clampMenuPosition(x, y, r.width, r.height, window.innerWidth, window.innerHeight))
  }, [x, y])

  if (typeof document === 'undefined') return null
  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[90]"
        data-testid="canvas-layout-menu-backdrop"
        onPointerDown={onClose}
        onContextMenu={(e) => {
          // React bubbles portal events through the component tree: don't let the preview re-open us.
          e.preventDefault()
          e.stopPropagation()
          onClose()
        }}
      />
      <div
        ref={ref}
        data-testid="canvas-layout-menu"
        role="menu"
        className="fixed z-[100] w-64 max-h-[min(560px,calc(100vh-16px))] overflow-y-auto rounded-md border bg-popover p-2 text-sm text-popover-foreground shadow-lg"
        style={{ left: pos.left, top: pos.top }}
        onPointerDown={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  )
}
