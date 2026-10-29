'use client'

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
}) {
  if (!stickerVisible(timing, durationMs, outputMs, totalMs)) return null
  const color = platform === 'kick' ? '#53FC18' : '#9146FF'
  const rect = stickerRect(boxWidth, boxHeight, x, y, anchor)
  return (
    <div
      className="pointer-events-none absolute rounded px-2 py-1 text-center font-bold text-white shadow"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        backgroundColor: color,
        fontSize: Math.max(10, rect.height / 3),
      }}
    >
      {(text || 'FOLLOW').slice(0, 32)}
    </div>
  )
}
