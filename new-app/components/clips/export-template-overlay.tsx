'use client'

import {
  exportTemplateOverlaysActive,
  formatHeadlineForExport,
  normalizeExportTemplate,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { overlayLayout, STREAM_HEADLINE_TOP } from '@/lib/clips/stream-overlay-layout'

/** Headline / badge / channel overlays for preview (matches export dialog toggles). */
export function ExportTemplateOverlay({
  edits,
  boxWidth,
  boxHeight,
  burnedIn = false,
}: {
  edits: ClipEditsV2
  boxWidth: number
  boxHeight: number
  /** Stream preview.mp4 already includes layout burn-in (grid cards). */
  burnedIn?: boolean
}) {
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  if (!tpl || !exportTemplateOverlaysActive(tpl)) return null
  if (boxWidth <= 0 || boxHeight <= 0) return null
  if (burnedIn) return null

  const layoutMode = edits.layout?.mode ?? 'speaker_follow'
  const useFitTop = layoutMode === 'fit_top' || layoutMode === 'full_frame'
  const headlineOn = Boolean(tpl.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline))
  const headline = formatHeadlineForExport(
    tpl.headlineBar?.text?.trim() || tpl.suggestedHeadline?.trim() || '',
  )
  const lines = headline ? wrapHeadlineDisplayLines(headline) : []
  const badgeOn = Boolean(tpl.platformBadge?.enabled)
  const channelOn = Boolean(tpl.channelLink?.enabled && tpl.channelLink.url?.trim())
  const platform = tpl.platform ?? 'twitch'
  const badgeColor = platform === 'kick' ? '#53FC18' : '#9146FF'
  const channelLabel = (tpl.channelLink?.url || '')
    .replace(/^https?:\/\//, '')
    .split('/')
    .filter(Boolean)
    .pop()
    ?.toUpperCase()

  const scaleY = boxHeight / 1920
  const scaleX = boxWidth / 1080

  if (useFitTop && headlineOn) {
    const lay = overlayLayout(Math.max(2, lines.length || 2), boxWidth, boxHeight)
    const sy = boxHeight / lay.playH
    const sx = boxWidth / lay.playW
    const fontPx = Math.max(10, Math.round(84 * sy))
    return (
      <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
        <div
          className="absolute inset-x-0 bg-white px-1 text-center font-black leading-[0.95] text-black"
          style={{
            top: lay.headlineTop * sy,
            height: lay.headlineH * sy,
            fontSize: fontPx,
            fontFamily: 'Anton, \"Bebas Neue\", Impact, sans-serif',
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-0">
            {lines.map((line) => (
              <span key={line} className="block w-full truncate px-1">
                {line}
              </span>
            ))}
          </div>
        </div>
        {badgeOn || channelOn ? (
          <div
            className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1"
            style={{
              top: lay.badgeY * sy,
              fontSize: Math.max(8, Math.round(28 * sy)),
            }}
          >
            {badgeOn ? (
              <span
                className="shrink-0 rounded px-1.5 py-0.5 font-bold text-white"
                style={{ backgroundColor: badgeColor }}
              >
                {platform === 'kick' ? 'KICK' : 'TWITCH'}
              </span>
            ) : null}
            {channelOn && channelLabel ? (
              <span className="max-w-[140px] truncate font-bold uppercase text-white drop-shadow">
                {channelLabel}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  const headlineTop = STREAM_HEADLINE_TOP * scaleY
  const barH = Math.round(boxHeight * 0.2)
  const videoH = Math.round(boxHeight * 0.52)
  const badgeBottom = headlineTop + barH + videoH - 10 * scaleY

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {headlineOn ? (
        <div
          className="absolute inset-x-0 bg-white px-2 text-center font-bold leading-tight text-black"
          style={{ top: headlineTop, height: barH, fontSize: Math.max(9, 11 * scaleX) }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.1]">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      ) : null}
      {badgeOn || channelOn ? (
        <div
          className="absolute inset-x-2 flex items-center gap-1"
          style={{ top: badgeBottom, fontSize: Math.max(8, 10 * scaleX) }}
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
