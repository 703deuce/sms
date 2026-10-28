'use client'

import {
  exportTemplateOverlaysActive,
  formatHeadlineForExport,
  normalizeExportTemplate,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { overlayLayout, STREAM_HEADLINE_TOP } from '@/lib/clips/stream-overlay-layout'

function ChatPreviewBox({
  lay,
  sy,
  opacity,
}: {
  lay: ReturnType<typeof overlayLayout>
  sy: number
  opacity: number
}) {
  const slotH = Math.max(8, Math.round((lay.chatH / 6) * sy))
  return (
    <div
      className="absolute inset-x-2 flex flex-col justify-end gap-0.5 overflow-hidden rounded-sm px-2 py-1"
      style={{
        top: lay.chatTop * sy,
        height: lay.chatH * sy,
        backgroundColor: `rgba(0,0,0,${Math.min(1, Math.max(0.15, opacity * 0.55))})`,
      }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="truncate text-white/90"
          style={{ fontSize: Math.max(7, Math.round(28 * sy)), lineHeight: `${slotH}px` }}
        >
          {i === 0 ? 'chat…' : '\u00a0'}
        </div>
      ))}
    </div>
  )
}

/** Headline / badge / channel overlays for preview (matches export dialog toggles). */
export function ExportTemplateOverlay({
  edits,
  boxWidth,
  boxHeight,
  burnedIn = false,
  channelDisplay,
  chatPreviewEnabled = false,
}: {
  edits: ClipEditsV2
  boxWidth: number
  boxHeight: number
  burnedIn?: boolean
  channelDisplay?: string | null
  chatPreviewEnabled?: boolean
}) {
  if (boxWidth <= 0 || boxHeight <= 0) return null
  if (burnedIn) return null

  const tpl = normalizeExportTemplate(edits.exportTemplate)
  const chatOn = Boolean(chatPreviewEnabled && edits.chatOverlay?.enabled)
  const overlaysActive = Boolean(tpl && exportTemplateOverlaysActive(tpl))
  if (!overlaysActive && !chatOn) return null

  const layoutMode = edits.layout?.mode ?? 'speaker_follow'
  const useFitTop = layoutMode === 'fit_top' || layoutMode === 'full_frame'
  const headlineOn = Boolean(
    tpl?.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline),
  )
  const headline = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || '',
  )
  const lines = headline ? wrapHeadlineDisplayLines(headline) : []
  const badgeOn = Boolean(tpl?.platformBadge?.enabled)
  const channelOn = Boolean(
    tpl?.channelLink?.enabled && (channelDisplay?.trim() || tpl?.channelLink.url?.trim()),
  )
  const channelLabel = (
    channelDisplay?.trim() ||
    (tpl?.channelLink?.url || '')
      .replace(/^https?:\/\//, '')
      .split('/')
      .filter(Boolean)
      .pop() ||
    ''
  ).toUpperCase()
  const showChannelName = Boolean(channelLabel && channelLabel !== 'NULL')

  const platform = tpl?.platform ?? 'twitch'
  const badgeColor = platform === 'kick' ? '#53FC18' : '#9146FF'
  const chatOpacity = edits.chatOverlay?.opacity ?? 0.6
  const scaleY = boxHeight / 1920
  const scaleX = boxWidth / 1080

  if (useFitTop && (headlineOn || chatOn)) {
    const lay = overlayLayout(Math.max(2, lines.length || 2), boxWidth, boxHeight)
    const sy = boxHeight / lay.playH
    const fontPx = Math.max(10, Math.round(84 * sy))
    return (
      <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
        {headlineOn ? (
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
        ) : null}
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
            {channelOn && showChannelName ? (
              <span className="max-w-[140px] truncate font-bold uppercase text-white drop-shadow">
                {channelLabel}
              </span>
            ) : null}
          </div>
        ) : null}
        {chatOn ? <ChatPreviewBox lay={lay} sy={sy} opacity={chatOpacity} /> : null}
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
          {channelOn && showChannelName ? (
            <span className="truncate font-bold uppercase text-white/95">{channelLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
