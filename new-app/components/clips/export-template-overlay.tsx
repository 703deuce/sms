'use client'

import {
  exportTemplateOverlaysActive,
  formatHeadlineForExport,
  normalizeExportTemplate,
  streamHeadlineFrameLayout,
  wrapHeadlineDisplayLines,
} from '@/lib/clips/export-template'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { badgeRenderState } from '@/lib/clips/render-plan/badge'
import { resolveLayers, type BadgeLayer, type HeadlineLayer, type StickerLayer } from '@/lib/clips/layers'
import { headlineStyleForPreset, badgePlacementForLayout } from '@/lib/clips/overlay-geometry'
import { usesStreamHeadlineBandOverlay } from '@/lib/clips/stream-compose-layout'
import { resolveComposeSpec, type ComposeSpec } from '@/lib/clips/compose-spec'
import { overlayLayout, STREAM_HEADLINE_TOP } from '@/lib/clips/stream-overlay-layout'
import { PlatformBadgePreview } from '@/components/clips/editor/platform-badge'
import { FollowStickerPreview } from '@/components/clips/editor/follow-sticker'
import { headlinePreviewBoxMetrics,
  headlinePreviewFontFamily,
  headlinePreviewFontWeight,
} from '@/lib/clips/headline-preview-style'
import { fitTopHeadlineLines } from '@/lib/clips/fit-top-headline-lines'
import { fitHeadlineDisplayForBox } from '@/lib/clips/headline-fit'
import { badgeRect } from '@/lib/clips/overlay-geometry'
import geom from '@/lib/clips/overlay-geometry.json'
import { LibassPublish } from '@/components/clips/editor/libass-context'
import type { HeadlineAssInput } from '@/lib/clips/render-plan/headline-ass'

const PLAY_W = 1080
const PLAY_H = 1920
const scalePx = (px: number, base: number) => Math.max(1, Math.floor((px * base) / 1920 + 0.5))

/**
 * EP2: the stream headline's headline_ass_content inputs, in play px, for libass-wasm — the same
 * band the worker burns into (stream_frame._fit_top_band_layers / apply_export_template).
 */
function streamHeadlineAssInput(o: {
  fitTopBand: boolean
  text: string
  lay: { headlineTop: number; headlineH: number }
  style: { textColor?: string } & Record<string, unknown>
  legacyBadgeText: string | null
}): Omit<HeadlineAssInput, 'durationMs'> {
  let textBoxX: number | null = null
  let textBoxW: number | null = null
  if (o.legacyBadgeText !== null) {
    if (o.fitTopBand) {
      const r = badgeRect('fit_top_band', PLAY_W, PLAY_H, { text: o.legacyBadgeText.slice(0, 24), showLogo: false, anchorTopGap: true })
      textBoxX = r.x + r.w + Math.max(8, scalePx(12, PLAY_W))
    } else {
      const bw = scalePx(Number((geom as { exportBar: { badgeW: number } }).exportBar.badgeW), PLAY_W)
      textBoxX = scalePx(24, PLAY_W) + bw + scalePx(12, PLAY_W)
    }
    textBoxW = Math.max(2, PLAY_W - textBoxX - scalePx(16, PLAY_W))
  }
  // clip_export_template._headline_style_from_edits: on the fit_top band a Montserrat/empty font
  // is drawn in Anton.
  const style: Record<string, unknown> = { ...o.style }
  if (o.fitTopBand && (!style.font || String(style.font).startsWith('Montserrat'))) style.font = 'Anton'
  return {
    headline: o.text,
    playW: PLAY_W,
    playH: PLAY_H,
    barH: o.fitTopBand ? o.lay.headlineH : Math.round(PLAY_H * Number((geom as { exportBar: { barFrac: number } }).exportBar.barFrac)),
    barY: o.fitTopBand ? o.lay.headlineTop : 0,
    fitTop: true,
    textColor: String(style.textColor || '#000000'),
    headlineStyle: style,
    textBoxX,
    textBoxW,
  }
}

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
  composeSpec: composeSpecProp,
  hideHeadline = false,
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
  composeSpec?: ComposeSpec | null
  /** T6.2: template mode draws its own title (TemplateTitleOverlay) in spec.titleRect. */
  hideHeadline?: boolean
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
  const headlineOn = !hideHeadline && Boolean(
    tpl?.headlineBar?.enabled && (tpl.headlineBar.text?.trim() || tpl.suggestedHeadline),
  )
  const headline = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || '',
  )
  const lines = useFitTop ? fitTopHeadlineLines(edits) : headline ? wrapHeadlineDisplayLines(headline) : []
  // EP1: the ONE badge rule shared with the worker (render-plan/badge.ts == layers_spec.badge_render_state).
  // Was `platformBadge.enabled || layer.showLabel`, which differed from the export in both directions.
  const badgeState = badgeRenderState(edits, { templateMode: hideHeadline })
  const badgeOn = badgeState.on && badgeState.showLabel
  const badgeLogo = badgeState.on && badgeState.showLogo
  const badgeHandle = badgeState.on && badgeState.source === 'sprite' ? badgeState.text : undefined
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
  const composeSpec = composeSpecProp ?? null
  // stream_frame._fit_top_band_layers reserves the text box from `channel or label`, where channel is
  // the channel-link URL's last segment (upper, ≤32) when the link is on.
  const linkUrl = tpl?.channelLink?.enabled ? String(tpl.channelLink.url || '') : ''
  const linkChannel = linkUrl ? (linkUrl.replace(/\/+$/, '').split('/').pop() || '').toUpperCase().slice(0, 32) : ''
  const legacyBadgeText = badgeState.on && badgeState.source === 'legacy' ? linkChannel || badgeState.text : null
  const headlineRaw = tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || ''
  const libassHeadline =
    headlineOn && headlineRaw && !(useFitTop && composeSpec)
      ? streamHeadlineAssInput({
          fitTopBand: useFitTop,
          text: headlineRaw,
          lay: overlayLayout(Math.max(2, lines.length || 2)),
          style: headlineStyle as { textColor?: string } & Record<string, unknown>,
          legacyBadgeText,
        })
      : null

  if (useFitTop && composeSpec && (headlineOn || chatOn || badgeOn || badgeLogo || channelOn || composeSpec.stickers.length)) {
    const sy = scaleY
    const sx = boxWidth / 1080
    const hl = composeSpec.headline
    return (
      <div className={`pointer-events-none absolute inset-0 ${hideHeadline ? 'z-[27]' : 'z-[25]'} overflow-hidden`}>
        {hl ? (
          <div
            data-testid="compose-headline"
            className="absolute text-center font-black"
            style={{
              top: hl.y * sy,
              left: hl.x * sx,
              width: hl.w * sx,
              height: hl.h * sy,
              fontSize: hl.fontPx * sy,
              lineHeight: hl.lineHeight,
              letterSpacing: 0,
              fontFamily: headlinePreviewFontFamily(hl.font),
              fontWeight: headlinePreviewFontWeight(hl.font),
              color: hl.textColor,
              backgroundColor: hl.boxColor,
              borderRadius: hl.radiusPx * sy,
            }}
          >
            <div className="flex h-full flex-col items-center justify-center">
              {hl.lines.map((line) => (
                <span key={line} style={{ whiteSpace: 'pre', display: 'block' }}>
                  {line}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {composeSpec.badge ? (
          <div
            data-testid="compose-badge"
            className="absolute flex items-center justify-center rounded-full text-white"
            style={{
              top: composeSpec.badge.y * sy,
              left: composeSpec.badge.x * sx,
              width: composeSpec.badge.w * sx,
              height: composeSpec.badge.h * sy,
              backgroundColor: composeSpec.badge.color,
              fontSize: composeSpec.badge.fontPx * sy,
              fontFamily: headlinePreviewFontFamily('Montserrat Black'),
            }}
          >
            {composeSpec.badge.text}
          </div>
        ) : null}
        {composeSpec.stickers.map((st, i) => (
          <div
            key={i}
            data-testid="compose-sticker"
            className="absolute flex items-center justify-center rounded-full font-bold text-white"
            style={{
              top: st.y * sy,
              left: st.x * sx,
              width: st.w * sx,
              height: st.h * sy,
              backgroundColor: st.color,
              fontSize: Math.max(10, (st.h / 3) * sy),
            }}
          >
            {st.text}
          </div>
        ))}
        {chatOn ? <ChatPreviewBox lay={overlayLayout(2)} sy={sy} opacity={chatOpacity} /> : null}
      </div>
    )
  }

  if (useFitTop && (headlineOn || chatOn || badgeOn || badgeLogo || channelOn)) {
    const lay = overlayLayout(Math.max(2, lines.length || 2))
    const sy = boxHeight / 1920
    const boxMetrics = headlinePreviewBoxMetrics(boxWidth, boxHeight, headlineStyle)
    const headlineText = formatHeadlineForExport(
      tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || headlineLayer?.text?.trim() || '',
    )
    const fit = headlineOn
      ? fitHeadlineDisplayForBox(headlineText, boxMetrics.width, lay.headlineH * sy)
      : { lines: [] as string[], fontPx: 10 }
    const displayLines = headlineOn ? fit.lines : []
    const fontPx = headlineOn ? fit.fontPx : Math.max(10, Math.round(84 * sy))
    return (
      <div className={`pointer-events-none absolute inset-0 ${hideHeadline ? 'z-[27]' : 'z-[25]'} overflow-hidden`}>
        <LibassPublish kind="headline" value={libassHeadline} />
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
            <div className="flex h-full flex-col items-center justify-center gap-0" data-libass-for="top" data-libass-ghost="text">
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
            handle={badgeHandle || channelLabel || badgeLayer?.handle}
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
    // EP1: in template mode the title band (TemplateTitleOverlay) is z-26 and the export burns the
    // badge sprite after the title → the badge must stack above it (it was hidden under the band).
    <div className={`pointer-events-none absolute inset-0 ${hideHeadline ? 'z-[27]' : 'z-[25]'} overflow-hidden`}>
      <LibassPublish kind="headline" value={libassHeadline} />
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
          <div className="flex h-full flex-col items-center justify-center gap-0 leading-[1.05]" data-libass-for="top" data-libass-ghost="text">
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
          handle={badgeHandle || channelLabel || badgeLayer?.handle}
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
