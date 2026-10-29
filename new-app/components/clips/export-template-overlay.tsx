'use client'

import {
  exportTemplateOverlaysActive,
  formatHeadlineForExport,
  normalizeExportTemplate,
  streamHeadlineFrameLayout,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { resolveLayers, type BadgeLayer, type HeadlineLayer, type StickerLayer } from '@/lib/clips/layers'
import { headlineStyleForPreset, badgePlacementForLayout } from '@/lib/clips/overlay-geometry'
import { overlayLayout, STREAM_HEADLINE_TOP } from '@/lib/clips/stream-overlay-layout'
import { usesStreamHeadlineBandOverlay, resolveStreamOverlayLayout } from '@/lib/clips/stream-compose-layout'
import { PlatformBadgePreview } from '@/components/clips/editor/platform-badge'
import { FollowStickerPreview } from '@/components/clips/editor/follow-sticker'
import { headlinePreviewBoxMetrics,
  headlinePreviewFontFamily,
  headlinePreviewFontWeight,
} from '@/lib/clips/headline-preview-style'
import { fitTopHeadlineLines } from '@/lib/clips/fit-top-headline-lines'
import { fitHeadlineBoldNewsForBox, fitHeadlineDisplayForBox } from '@/lib/clips/headline-fit'

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
  const streamOverlay = usesStreamHeadlineBandOverlay(edits)
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
  const useFitTop = layoutMode === 'fit_top' || streamOverlay
  const headlineLayer = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const headlineStyle = headlineLayer?.style ?? headlineStyleForPreset(useFitTop ? 'bold_news' : 'export_bar')
  const headlineOn = Boolean(
    tpl?.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline),
  )
  const headline = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || '',
  )
  const lines = useFitTop ? fitTopHeadlineLines(edits) : headline ? wrapHeadlineDisplayLines(headline) : []
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

  if (useFitTop && (headlineOn || chatOn || badgeOn || badgeLogo || channelOn)) {
    const lay = resolveStreamOverlayLayout(edits, Math.max(2, lines.length || 2))
    const sy = boxHeight / 1920
    const boxMetrics = headlinePreviewBoxMetrics(boxWidth, boxHeight, headlineStyle)
    const headlineText = formatHeadlineForExport(
      tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || headlineLayer?.text?.trim() || '',
    )
    const fit = headlineOn
      ? fitHeadlineBoldNewsForBox(headlineText, boxMetrics.width, lay.headlineH * sy)
      : { lines: [] as string[], fontPx: 10 }
    const displayLines = headlineOn ? fit.lines : []
    const fontPx = headlineOn ? fit.fontPx : Math.max(10, Math.round(84 * sy))
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
              {displayLines.map((line) => (
                <span key={line} className="block w-full break-words px-1">
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
            placement={badgePlacementForLayout(layoutMode, edits)}
            layoutMode={layoutMode}
            boxWidth={boxWidth}
            boxHeight={boxHeight}
            videoY={lay.videoY}
            videoH={lay.videoH}
            badgeAnchorTopGap
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
  const frameLay = streamHeadlineFrameLayout(Math.round(boxHeight))
  const barH = frameLay.barHeightPx * scaleY
  const videoTop = frameLay.videoTopPx * scaleY
  const videoH = frameLay.videoHeightPx * scaleY
  const barMetrics = headlinePreviewBoxMetrics(boxWidth, boxHeight, headlineStyle)
  const fit = headlineOn ? fitHeadlineDisplayForBox(headline, barMetrics.width, barH) : null
  const headlineFontPx = fit?.fontPx ?? Math.max(
    10,
    Math.min(
      (barH * 0.52) / Math.max(1, lines.length),
      barH * 0.45,
    ),
  )
  const barLines = fit?.lines ?? lines

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
            fontSize: headlineFontPx,
            fontFamily: headlinePreviewFontFamily(headlineStyle.font),
            fontWeight: headlinePreviewFontWeight(headlineStyle.font),
            color: headlineStyle.textColor,
            backgroundColor: headlineStyle.boxColor,
            borderRadius: barMetrics.borderRadius,
          }}
        >
          <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.05]">
            {barLines.map((line) => (
              <span key={line} className="block w-full break-words px-1">
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
          placement="export_bar"
          boxWidth={boxWidth}
          boxHeight={boxHeight}
          videoY={videoTop}
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
