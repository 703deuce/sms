'use client'

import { streamHeadlineFrameLayout } from '@/lib/clips/export-template'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'

export function ExportHeadlinePreview({
  headline,
  showBadge,
  platform,
  channelUrl,
  exportPlatformId = 'tiktok',
}: {
  headline: string
  showBadge: boolean
  platform?: 'twitch' | 'kick'
  channelUrl?: string
  exportPlatformId?: ExportPlatformId
}) {
  const badgeColor = platform === 'kick' ? '#53FC18' : '#9146FF'
  const h = 280
  const scale = h / 1920
  const { barHeightPx, videoHeightPx, videoTopPx, footerHeightPx } = streamHeadlineFrameLayout(1920)
  const barH = barHeightPx * scale
  const videoTop = videoTopPx * scale
  const videoH = videoHeightPx * scale
  const footerH = footerHeightPx * scale
  const textY = barH * 0.45
  const badgeBottom = videoTop + videoH - 14

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-zinc-800 text-white">
      <div className="relative mx-auto w-full max-w-[140px]" style={{ height: h }}>
        <div className="absolute inset-0 bg-zinc-700/80" aria-hidden />
        {headline ? (
          <div
            className="absolute inset-x-0 top-0 bg-white px-1 text-center font-bold leading-tight text-black"
            style={{ height: barH, paddingTop: Math.max(2, textY - 4) }}
          >
            <span className="text-[9px]">{headline}</span>
          </div>
        ) : null}
        <div
          className="absolute inset-x-1 rounded-sm bg-zinc-900/90 text-center text-[8px] text-zinc-500"
          style={{ top: videoTop, height: videoH }}
        >
          16:9 + blur fill
        </div>
        <div
          className="absolute inset-x-0 bg-black"
          style={{ top: videoTop + videoH, height: footerH }}
          aria-hidden
        />
        {showBadge || channelUrl ? (
          <div
            className="absolute inset-x-1 flex items-center gap-1"
            style={{ top: badgeBottom, height: 14 }}
          >
            {showBadge ? (
              <span
                className="shrink-0 rounded px-1 py-0 text-[7px] font-bold text-white"
                style={{ backgroundColor: badgeColor }}
              >
                {(platform || 'twitch').toUpperCase()}
              </span>
            ) : null}
            {channelUrl ? (
              <span className="truncate text-[7px] font-bold uppercase text-white/95">
                {channelUrl.replace(/^https?:\/\//, '')}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
