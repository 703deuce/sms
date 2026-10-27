'use client'

import { useRef, useState } from 'react'
import type { ReframeCropRect } from '@/lib/clips/script-edl/types'
import { cn } from '@/lib/utils'

/** Draggable crop box for manual reframe (spec §B5 / D1 #47). */
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
  const [drag, setDrag] = useState<{ x0: number; y0: number; crop0: ReframeCropRect } | null>(null)

  if (!enabled) return null

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDrag({ x0: e.clientX, y0: e.clientY, crop0: crop })
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !boxRef.current?.parentElement) return
    const rect = boxRef.current.parentElement.getBoundingClientRect()
    const dx = ((e.clientX - drag.x0) / rect.width) * drag.crop0.w
    const dy = ((e.clientY - drag.y0) / rect.height) * drag.crop0.h
    onCropChange({
      ...drag.crop0,
      cx: Math.min(100, Math.max(0, drag.crop0.cx - dx)),
      cy: Math.min(100, Math.max(0, drag.crop0.cy - dy)),
    })
  }

  const onPointerUp = () => {
    if (drag) onCommit()
    setDrag(null)
  }

  return (
    <div
      ref={boxRef}
      role="presentation"
      className={cn(
        'absolute z-10 cursor-grab border-2 border-dashed border-primary shadow-sm',
        drag && 'cursor-grabbing',
      )}
      style={{
        left: `${crop.cx - crop.w / 2}%`,
        top: `${crop.cy - crop.h / 2}%`,
        width: `${crop.w}%`,
        height: `${crop.h}%`,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      data-testid="script-reframe-crop-box"
    />
  )
}
