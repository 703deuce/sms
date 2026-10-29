'use client'

import { useCallback, useRef, useState } from 'react'
import { stickerRect, stickerVisible } from '@/lib/clips/overlay-geometry'

export function FollowStickerPreview({
  text,
  platform,
  x,
  y,
  anchor = 'TR',
  boxWidth,
  boxHeight,
  timing = 'always',
  durationMs = 4000,
  outputMs = 0,
  totalMs = 0,
  onMove,
}: {
  text: string
  platform?: 'twitch' | 'kick'
  x: number
  y: number
  anchor?: 'TL' | 'TR' | 'BL' | 'BR'
  boxWidth: number
  boxHeight: number
  timing?: 'always' | 'intro' | 'outro'
  durationMs?: number
  outputMs?: number
  totalMs?: number
  onMove?: (x: number, y: number) => void
}) {
  if (!stickerVisible(timing, durationMs, outputMs, totalMs)) return null
  const color = platform === 'kick' ? '#53FC18' : '#9146FF'
  const draggable = Boolean(onMove)
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null)
  const parentRef = useRef<HTMLDivElement>(null)
  const posX = draft?.x ?? x
  const posY = draft?.y ?? y
  const rect = stickerRect(boxWidth, boxHeight, posX, posY, anchor)

  const clampCenter = useCallback(
    (cx: number, cy: number) => {
      const r = stickerRect(boxWidth, boxHeight, cx, cy, anchor)
      let nx = cx
      let ny = cy
      if (r.left < 0) nx += -r.left / boxWidth
      if (r.top < 0) ny += -r.top / boxHeight
      if (r.left + r.width > boxWidth) nx -= (r.left + r.width - boxWidth) / boxWidth
      if (r.top + r.height > boxHeight) ny -= (r.top + r.height - boxHeight) / boxHeight
      return {
        x: Math.max(0.05, Math.min(0.95, nx)),
        y: Math.max(0.05, Math.min(0.95, ny)),
      }
    },
    [anchor, boxHeight, boxWidth],
  )

  return (
    <div ref={parentRef} className="absolute inset-0" data-testid="follow-sticker-layer">
      <div
        role={draggable ? 'button' : undefined}
        tabIndex={draggable ? 0 : undefined}
        className={`absolute rounded px-2 py-1 text-center font-bold text-white shadow ${draggable ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none'}`}
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          backgroundColor: color,
          fontSize: Math.max(10, rect.height / 3),
          pointerEvents: draggable ? 'auto' : 'none',
        }}
        onPointerDown={
          draggable
            ? (e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                setDraft({ x: posX, y: posY })
              }
            : undefined
        }
        onPointerMove={
          draggable
            ? (e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
                const parent = parentRef.current?.parentElement
                if (!parent) return
                const b = parent.getBoundingClientRect()
                const cx = (e.clientX - b.left) / b.width
                const cy = (e.clientY - b.top) / b.height
                setDraft(clampCenter(cx, cy))
              }
            : undefined
        }
        onPointerUp={
          draggable
            ? (e) => {
                if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
                e.currentTarget.releasePointerCapture(e.pointerId)
                const next = draft ?? { x: posX, y: posY }
                setDraft(null)
                onMove?.(next.x, next.y)
              }
            : undefined
        }
        onKeyDown={
          draggable
            ? (e) => {
                const step = e.shiftKey ? 0.05 : 0.01
                let nx = posX
                let ny = posY
                if (e.key === 'ArrowLeft') nx -= step
                if (e.key === 'ArrowRight') nx += step
                if (e.key === 'ArrowUp') ny -= step
                if (e.key === 'ArrowDown') ny += step
                if (nx !== posX || ny !== posY) {
                  e.preventDefault()
                  const c = clampCenter(nx, ny)
                  onMove?.(c.x, c.y)
                }
              }
            : undefined
        }
      >
        {(text || 'FOLLOW').slice(0, 32)}
      </div>
    </div>
  )
}
