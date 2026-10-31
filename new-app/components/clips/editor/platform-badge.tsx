'use client'

import { badgePlacementForLayout, badgeRect } from '@/lib/clips/overlay-geometry'
import { headlinePreviewFontFamily } from '@/lib/clips/headline-preview-style'
import { LibassPublish } from '@/components/clips/editor/libass-context'

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
  badgeAnchorTopGap,
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
  badgeAnchorTopGap?: boolean
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
    anchorTopGap: badgeAnchorTopGap,
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
        // EP1: the export sprite (layer_sprites.render_badge_png) is a square-cornered rect with
        // Montserrat Black text at fontPx — the preview drew a rounded pill in the UI font.
        borderRadius: 0,
        fontFamily: headlinePreviewFontFamily('Montserrat Black'),
        fontWeight: 900,
        lineHeight: 1,
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
      {showLabel && text ? (
        <span data-libass-for="top" data-libass-ghost="text" data-testid="badge-text">
          {text}
        </span>
      ) : null}
      {/* EP2: libass-wasm draws the text over this sprite rect (badge-ass.ts mirrors drawtext). */}
      <LibassPublish
        kind="badge"
        value={showLabel && text ? { rect, text, showLogo, playW, playH } : null}
      />
    </div>
  )
}
