'use client'

import { badgeRect } from '@/lib/clips/overlay-geometry'

export function PlatformBadgePreview({
  platform,
  showLabel,
  showLogo,
  handle,
  placement,
  boxWidth,
  boxHeight,
  videoY = 0,
  videoH = 0,
  badgeY,
}: {
  platform: 'twitch' | 'kick' | 'none'
  showLabel: boolean
  showLogo: boolean
  handle?: string
  placement: 'fit_top_band' | 'export_bar'
  boxWidth: number
  boxHeight: number
  videoY?: number
  videoH?: number
  badgeY?: number
}) {
  if (platform === 'none' || (!showLabel && !showLogo)) return null
  const playW = 1080
  const playH = 1920
  const rect = badgeRect(placement, playW, playH, { videoY, videoH, badgeY: badgeY ?? null })
  const sx = boxWidth / playW
  const sy = boxHeight / playH
  const color = platform === 'kick' ? '#53FC18' : '#9146FF'
  const label = platform === 'kick' ? 'KICK' : 'TWITCH'
  const text = (handle || label).toUpperCase().slice(0, 24)

  return (
    <div
      className="pointer-events-none absolute flex items-center gap-1 rounded font-bold text-white"
      style={{
        left: rect.x * sx,
        top: rect.y * sy,
        width: rect.w * sx,
        height: rect.h * sy,
        backgroundColor: showLogo ? color : color,
        fontSize: Math.max(8, Math.round((rect.h * sy) / 3)),
        paddingLeft: showLogo ? 4 : 8,
        paddingRight: 8,
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={platform === 'kick' ? '/brand/kick_black_128.png' : '/brand/twitch_white_128.png'}
          alt=""
          width={Math.min(rect.w * sx - 8, 28)}
          height={Math.min(rect.h * sy - 4, 28)}
          className="shrink-0 object-contain"
          aria-hidden
        />
      ) : null}
      {showLabel ? <span className="truncate">{text}</span> : null}
    </div>
  )
}
