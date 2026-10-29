'use client'

import {
  exportTemplateOverlaysActive,
  formatHeadlineForExport,
  normalizeExportTemplate,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { resolveLayers, type BadgeLayer, type HeadlineLayer, type StickerLayer } from '@/lib/clips/layers'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import { overlayLayout, STREAM_HEADLINE_TOP } from '@/lib/clips/stream-overlay-layout'
import { PlatformBadgePreview } from '@/components/clips/editor/platform-badge'
import { FollowStickerPreview } from '@/components/clips/editor/follow-sticker'
import {
  headlinePreviewBoxMetrics,
  headlinePreviewFontFamily,
  headlinePreviewFontWeight,
} from '@/lib/clips/headline-preview-style'

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
  outputMs = 0,
  outputDurationMs = 0,
  onStickerMove,
}: {
  edits: ClipEditsV2
  boxWidth: number
  boxHeight: number
  burnedIn?: boolean
  channelDisplay?: string | null
  chatPreviewEnabled?: boolean
  outputMs?: number
  outputDurationMs?: number
  onStickerMove?: (x: number, y: number) => void
}) {
  if (boxWidth <= 0 || boxHeight <= 0) return null
  if (burnedIn) return null

  const tpl = normalizeExportTemplate(edits.exportTemplate)
  const chatOn = Boolean(chatPreviewEnabled && edits.chatOverlay?.enabled)
  const overlaysActive = Boolean(tpl && exportTemplateOverlaysActive(tpl))
  if (!overlaysActive && !chatOn) return null

  const layoutMode = edits.layout?.mode ?? 'speaker_follow'
  let layers: ReturnType<typeof resolveLayers> = []
  try {
    layers = resolveLayers(edits)
  } catch (e) {
    console.error('[clipper:export] layers_resolve_fail', e)
  }
  const badgeLayer = layers.find((l): l is BadgeLayer => l.id === 'badge' && l.type === 'badge' && l.enabled)
  const stickerLayer = layers.find(
    (l): l is StickerLayer => l.type === 'sticker' && l.kind === 'follow_cta' && l.enabled,
  )
  const useFitTop = layoutMode === 'fit_top'
  const headlineLayer = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const headlineStyle = headlineLayer?.style ?? headlineStyleForPreset(useFitTop ? 'stream_white_box' : 'export_bar')
  const headlineOn = Boolean(
    tpl?.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline),
  )
  const headline = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || '',
  )
  const lines = headline ? wrapHeadlineDisplayLines(headline) : []
  const badgeOn = Boolean(tpl?.platformBadge?.enabled || badgeLayer?.showLabel)
  const badgeLogo = Boolean(badgeLayer?.showLogo)
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

  const platform = tpl?.platform ?? 'twitch'
  const chatOpacity = edits.chatOverlay?.opacity ?? 0.6
  const scaleY = boxHeight / 1920
  const scaleX = boxWidth / 1080

  if (useFitTop && (headlineOn || chatOn)) {
    const lay = overlayLayout(Math.max(2, lines.length || 2))
    const sy = boxHeight / 1920
    const fontPx = Math.max(10, Math.round(84 * sy))
    const boxMetrics = headlinePreviewBoxMetrics(boxWidth, boxHeight, headlineStyle)
    return (
      <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
        {headlineOn ? (
          <div
            className="absolute px-1 text-center font-black leading-[0.95]"
            style={{
              top: lay.headlineTop * sy,
              height: lay.headlineH * sy,
              left: boxMetrics.left,
              width: boxMetrics.width,
              fontSize: fontPx,
              fontFamily: headlinePreviewFontFamily(headlineStyle.font),
              fontWeight: headlinePreviewFontWeight(headlineStyle.font),
              color: headlineStyle.textColor,
              backgroundColor: headlineStyle.boxColor,
              borderRadius: boxMetrics.borderRadius,
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
        {badgeOn || badgeLogo || channelOn ? (
          <PlatformBadgePreview
            platform={(badgeLayer?.platform ?? platform) as 'twitch' | 'kick' | 'none'}
            showLabel={badgeOn}
            showLogo={badgeLogo}
            handle={channelLabel || badgeLayer?.handle}
            placement="fit_top_band"
            boxWidth={boxWidth}
            boxHeight={boxHeight}
            videoY={lay.videoY}
            videoH={lay.videoH}
            badgeY={lay.badgeY}
            layoutMode={layoutMode}
          />
        ) : null}
        {stickerLayer ? (
          <FollowStickerPreview
            text={stickerLayer.text}
            platform={stickerLayer.platform}
            x={stickerLayer.x}
            y={stickerLayer.y}
            anchor={stickerLayer.anchor}
            timing={stickerLayer.timing}
            durationMs={stickerLayer.durationMs}
            outputMs={outputMs}
            totalMs={outputDurationMs}
            boxWidth={boxWidth}
            boxHeight={boxHeight}
            onMove={onStickerMove}
          />
        ) : null}
        {chatOn ? <ChatPreviewBox lay={lay} sy={sy} opacity={chatOpacity} /> : null}
      </div>
    )
  }

  const headlineTop = STREAM_HEADLINE_TOP * scaleY
  const barH = Math.round(boxHeight * 0.2)
  const videoH = Math.round(boxHeight * 0.52)
  const barMetrics = headlinePreviewBoxMetrics(boxWidth, boxHeight, headlineStyle)

  return (
    <div className="pointer-events-none absolute inset-0 z-[25] overflow-hidden">
      {headlineOn ? (
        <div
          className="absolute px-2 text-center font-bold leading-tight"
          style={{
            top: headlineTop,
            height: barH,
            left: barMetrics.left,
            width: barMetrics.width,
            fontSize: Math.max(9, 11 * scaleX),
            fontFamily: headlinePreviewFontFamily(headlineStyle.font),
            fontWeight: headlinePreviewFontWeight(headlineStyle.font),
            color: headlineStyle.textColor,
            backgroundColor: headlineStyle.boxColor,
            borderRadius: barMetrics.borderRadius,
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.1]">
            {lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>
      ) : null}
      {badgeOn || badgeLogo || channelOn ? (
        <PlatformBadgePreview
          platform={(badgeLayer?.platform ?? platform) as 'twitch' | 'kick' | 'none'}
          showLabel={badgeOn}
          showLogo={badgeLogo}
          handle={channelLabel || badgeLayer?.handle}
          placement="export_bar"
          boxWidth={boxWidth}
          boxHeight={boxHeight}
          videoY={headlineTop}
          videoH={videoH}
        />
      ) : null}
      {stickerLayer ? (
        <FollowStickerPreview
          text={stickerLayer.text}
          platform={stickerLayer.platform}
          x={stickerLayer.x}
          y={stickerLayer.y}
          boxWidth={boxWidth}
          boxHeight={boxHeight}
        />
      ) : null}
    </div>
  )
}
