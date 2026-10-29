'use client'

import { badgePlacementForLayout, badgeRect } from '@/lib/clips/overlay-geometry'

export function PlatformBadgePreview({
  platform,
  showLabel,
  showLogo,
  handle,
  placement,
  layoutMode,
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
  placement?: 'fit_top_band' | 'export_bar'
  layoutMode?: string
  boxWidth: number
  boxHeight: number
  videoY?: number
  videoH?: number
  badgeY?: number
}) {
  if (platform === 'none' || (!showLabel && !showLogo)) return null
  const playW = 1080
  const playH = 1920
  const resolvedPlacement = placement ?? badgePlacementForLayout(layoutMode ?? 'speaker_follow')
  const label = platform === 'kick' ? 'KICK' : 'TWITCH'
  const text = (showLabel ? (handle || label) : '').toUpperCase().slice(0, 24)
  const rect = badgeRect(resolvedPlacement, playW, playH, {
    text,
    showLogo,
    videoY,
    videoH,
    badgeY: badgeY ?? null,
  })
  const sx = boxWidth / playW
  const sy = boxHeight / playH
  const s = playH / 1920
  const color = platform === 'kick' ? '#53FC18' : '#9146FF'
  const logoH = Math.max(8, Math.round(40 * s * sy))
  const fontPx = Math.max(8, Math.round(32 * s * sy))

  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center gap-1 font-bold text-white"
      style={{
        left: rect.x * sx,
        top: rect.y * sy,
        width: rect.w * sx,
        height: rect.h * sy,
        backgroundColor: color,
        fontSize: fontPx,
        paddingLeft: showLogo ? Math.round(22 * s * sx) : Math.round(12 * sx),
        paddingRight: Math.round(12 * sx),
        borderRadius: (rect.h * sy) / 2,
        whiteSpace: 'nowrap',
      }}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={platform === 'kick' ? '/brand/kick_black_128.png' : '/brand/twitch_white_128.png'}
          alt=""
          height={logoH}
          className="shrink-0 object-contain"
          style={{ height: logoH, width: 'auto' }}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
          aria-hidden
        />
      ) : null}
      {showLabel && text ? <span>{text}</span> : null}
    </div>
  )
}
