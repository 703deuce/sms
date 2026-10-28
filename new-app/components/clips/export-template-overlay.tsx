'use client'

import {
  exportTemplateOverlaysActive,
  normalizeExportTemplate,
  streamHeadlineFrameLayout,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'

/** Headline / badge / channel overlays for preview (matches export dialog toggles). */
export function ExportTemplateOverlay({
  edits,
  boxWidth,
  boxHeight,
}: {
  edits: ClipEditsV2
  boxWidth: number
  boxHeight: number
}) {
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  if (!tpl || !exportTemplateOverlaysActive(tpl)) return null
  if (boxWidth <= 0 || boxHeight <= 0) return null

  const playH = boxHeight
  const { barHeightPx, videoTopPx, videoHeightPx, footerHeightPx } = streamHeadlineFrameLayout(playH)
  const scale = 1
  const barH = barHeightPx * scale
  const videoTop = videoTopPx * scale
  const videoH = videoHeightPx * scale
  const footerH = footerHeightPx * scale
  const headlineOn = Boolean(tpl.headlineBar?.enabled && tpl.headlineBar.text?.trim())
  const headline = tpl.headlineBar?.text?.trim() || ''
  const lines = headline ? wrapHeadlineDisplayLines(headline) : []
  const badgeOn = Boolean(tpl.platformBadge?.enabled)
  const channelOn = Boolean(tpl.channelLink?.enabled && tpl.channelLink.url?.trim())
  const platform = tpl.platform ?? 'twitch'
  const badgeColor = platform === 'kick' ? '#53FC18' : '#9146FF'
  const badgeBottom = videoTop + videoH - 10 * scale

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {headlineOn ? (
        <div
          className="absolute inset-x-0 top-0 bg-white px-2 text-center font-bold leading-tight text-black"
          style={{ height: barH, fontSize: Math.max(9, 11 * scale) }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.1]">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      ) : null}
      {footerH > 2 ? (
        <div
          className="absolute inset-x-0 bg-black/90"
          style={{ top: videoTop + videoH, height: footerH }}
          aria-hidden
        />
      ) : null}
      {badgeOn || channelOn ? (
        <div
          className="absolute inset-x-2 flex items-center gap-1"
          style={{ top: badgeBottom, fontSize: Math.max(8, 10 * scale) }}
        >
          {badgeOn ? (
            <span
              className="shrink-0 rounded px-1 py-0 font-bold text-white"
              style={{ backgroundColor: badgeColor }}
            >
              {platform.toUpperCase()}
            </span>
          ) : null}
          {channelOn ? (
            <span className="truncate font-bold uppercase text-white/95">
              {(tpl.channelLink?.url || '').replace(/^https?:\/\//, '')}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
