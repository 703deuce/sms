'use client'

import { fitHeadlineDisplayForBox } from '@/lib/clips/headline-fit'
import { streamHeadlineFrameLayout } from '@/lib/clips/export-template'
import type { ExportPlatformId } from '@/lib/clips/export-platform-presets'
import {
  headlinePreviewBoxMetrics,
  headlinePreviewFontFamily,
  headlinePreviewFontWeight,
} from '@/lib/clips/headline-preview-style'

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
  const previewW = 140
  const h = 280
  const frameLay = streamHeadlineFrameLayout(h)
  const barH = frameLay.barHeightPx
  const videoTop = frameLay.videoTopPx
  const videoH = frameLay.videoHeightPx
  const footerH = frameLay.footerHeightPx
  const badgeBottom = videoTop + videoH - 14
  const headlineStyle = {
    preset: 'stream_white' as const,
    textColor: '#000000',
    boxColor: '#ffffff',
    radiusPx: 0,
    widthPct: 100,
  }
  const barMetrics = headlinePreviewBoxMetrics(previewW, h, headlineStyle)
  const fit = headline ? fitHeadlineDisplayForBox(headline, barMetrics.width, barH) : null
  const headlineLines = fit?.lines ?? []
  const headlineFontPx = fit?.fontPx ?? 8

  return (
    <div className="mt-2 overflow-hidden rounded-md border border-border bg-zinc-800 text-white">
      <div className="relative mx-auto w-full max-w-[140px]" style={{ height: h }}>
        <div className="absolute inset-0 bg-zinc-700/80" aria-hidden />
        {headline ? (
          <div
            className="absolute top-0 text-center font-bold leading-tight text-black"
            style={{
              height: barH,
              left: barMetrics.left,
              width: barMetrics.width,
              fontSize: headlineFontPx,
              fontFamily: headlinePreviewFontFamily(undefined),
              fontWeight: headlinePreviewFontWeight(undefined),
              backgroundColor: headlineStyle.boxColor,
              borderRadius: barMetrics.borderRadius,
            }}
          >
            <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.05]">
              {headlineLines.map((line) => (
                <span key={line} className="block w-full break-words px-1">
                  {line}
                </span>
              ))}
            </div>
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
