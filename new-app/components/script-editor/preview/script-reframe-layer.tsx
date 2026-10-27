'use client'

import { useRef, useState } from 'react'
import type { ReframeCropRect } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

type DragState =
  | { mode: 'move'; x0: number; y0: number; crop0: ReframeCropRect }
  | { mode: 'resize'; x0: number; y0: number; crop0: ReframeCropRect }

/** Draggable + resizable crop box for manual reframe (ui-layouts §7). */
export function ScriptReframeCropOverlay({
  crop,
  enabled,
  onCropChange,
  onCommit,
}: {
  crop: ReframeCropRect
  enabled: boolean
  onCropChange: (next: ReframeCropRect) => void
  onCommit: () => void
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<DragState | null>(null)

  if (!enabled) return null

  const parentRect = () => boxRef.current?.parentElement?.getBoundingClientRect()

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return
    const rect = parentRect()
    if (!rect) return
    const dxPct = ((e.clientX - drag.x0) / rect.width) * 100
    const dyPct = ((e.clientY - drag.y0) / rect.height) * 100
    if (drag.mode === 'move') {
      const dx = (dxPct / 100) * drag.crop0.w
      const dy = (dyPct / 100) * drag.crop0.h
      onCropChange({
        ...drag.crop0,
        cx: Math.min(100, Math.max(0, drag.crop0.cx - dx)),
        cy: Math.min(100, Math.max(0, drag.crop0.cy - dy)),
      })
    } else {
      onCropChange({
        ...drag.crop0,
        w: Math.min(100, Math.max(20, drag.crop0.w + dxPct)),
        h: Math.min(100, Math.max(20, drag.crop0.h + dyPct)),
      })
    }
  }

  const endDrag = () => {
    if (drag) onCommit()
    setDrag(null)
  }

  return (
    <div
      ref={boxRef}
      role="presentation"
      className={cn(
        'absolute z-10 border-2 border-dashed border-primary shadow-sm',
        drag?.mode === 'move' ? 'cursor-grab' : '',
        drag && drag.mode === 'move' && 'cursor-grabbing',
      )}
      style={{
        left: `${crop.cx - crop.w / 2}%`,
        top: `${crop.cy - crop.h / 2}%`,
        width: `${crop.w}%`,
        height: `${crop.h}%`,
      }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      data-testid="script-reframe-crop-box"
    >
      <div
        className="absolute inset-0 cursor-grab"
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag({ mode: 'move', x0: e.clientX, y0: e.clientY, crop0: crop })
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
      />
      <div
        className="absolute -bottom-1 -right-1 size-3 cursor-se-resize rounded-sm border border-primary bg-background"
        data-testid="script-reframe-resize-handle"
        onPointerDown={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setDrag({ mode: 'resize', x0: e.clientX, y0: e.clientY, crop0: crop })
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        }}
      />
    </div>
  )
}
