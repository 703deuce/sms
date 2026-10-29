import geom from '@/lib/clips/overlay-geometry.json'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { formatHeadlineForExport, normalizeExportTemplate } from '@/lib/clips/export-template'
import {
  resolveLayers,
  handleFromUrl,
  type HeadlineLayer,
  type BadgeLayer,
  type StickerLayer,
} from '@/lib/clips/layers'
import { usesStreamHeadlineBandOverlay } from '@/lib/clips/stream-compose-layout'
import { overlayLayout } from '@/lib/clips/stream-overlay-layout'
import { badgeRect, stickerRectPx, headlineStyleForPreset } from '@/lib/clips/overlay-geometry'
import { fitBoldNewsHeadline } from '@/lib/clips/headline-fit-bold'
import { fontMetrics } from '@/lib/clips/font-measure'
import { clampCaptionExportStyle } from '@/lib/clips/caption-safe-area'
import { resolveCaptionPreset } from '@/lib/clips/caption-presets'

export const COMPOSE_SPEC_VERSION = 1
export type Rect = { x: number; y: number; w: number; h: number }
export type ComposeSpec = {
  v: 1
  kind: 'stream_band'
  playW: number
  playH: number
  bg: { kind: 'blur_cover'; blurPx: 20; brightness: 0.92 }
  video: Rect & { fit: 'cover' }
  headline: null | (Rect & {
    lines: string[]
    fontPx: number
    lineHeight: number
    font: string
    textColor: string
    boxColor: string
    radiusPx: number
    preset: string
  })
  badge:
    | null
    | (Rect & {
        platform: string
        text: string
        showLogo: boolean
        fontPx: number
        logoPx: number
        padX: number
        gap: number
        color: string
      })
  stickers: (Rect & {
    text: string
    color: string
    timing: 'always' | 'intro' | 'outro'
    durationMs: number
  })[]
  captions: {
    font: string
    assFontsize: number
    emPx: number
    maxLineWidthPx: number
    marginVPct: number
    position: string
  }
  zoom: { target: 'video' }
}

const even = (n: number) => (n % 2 ? n - 1 : n)

const PLATFORMS = geom.platforms as Record<string, { label: string; color: string }>

export function resolveStreamHeadlineStyle(layer: HeadlineLayer | undefined) {
  const st = layer?.style
  const userFont = st?.font?.trim()
  const presetColors = headlineStyleForPreset(st?.preset ?? 'bold_news')
  return {
    preset:
      st?.preset === 'stream_yellow' || st?.preset === 'export_bar_dark' ? st.preset : 'bold_news',
    font: userFont && userFont !== 'Anton' ? userFont : 'Anton',
    textColor: st?.textColor ?? presetColors.textColor,
    boxColor: st?.boxColor ?? presetColors.boxColor,
    radiusPx: st?.radiusPx ?? 0,
    widthPct: st?.widthPct ?? 100,
  }
}

function badgeLabelText(edits: ClipEditsV2, badgeLayer: BadgeLayer | undefined): string {
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  const url = String(tpl?.channelLink?.url ?? badgeLayer?.url ?? '')
  const fromUrl = handleFromUrl(url)
  const raw =
    fromUrl?.trim() ||
    badgeLayer?.handle?.trim() ||
    url
      .replace(/^https?:\/\//, '')
      .split('/')
      .filter(Boolean)
      .pop() ||
    ''
  return raw.toUpperCase().slice(0, 24)
}

function buildBadgeSpec(
  edits: ClipEditsV2,
  playW: number,
  playH: number,
  badgeLayer: BadgeLayer,
  videoY: number,
  videoH: number,
): ComposeSpec['badge'] {
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  const plat = (badgeLayer.platform === 'kick' ? 'kick' : badgeLayer.platform === 'none' ? 'default' : 'twitch') as
    | 'twitch'
    | 'kick'
    | 'default'
  const platMeta = PLATFORMS[plat] ?? PLATFORMS.default
  const showLogo = Boolean(badgeLayer.showLogo)
  const badgeOn = Boolean(tpl?.platformBadge?.enabled || badgeLayer.showLabel)
  const channelOn = Boolean(tpl?.channelLink?.enabled && (tpl?.channelLink?.url?.trim() || badgeLayer.handle))
  if (!badgeOn && !showLogo && !channelOn) return null
  const text = badgeLabelText(edits, badgeLayer)
  const badgeGeom = geom.badge ?? {}
  const s = playH / 1920
  const rect = badgeRect('fit_top_band', playW, playH, {
    text,
    showLogo,
    videoY,
    videoH,
    anchorTopGap: true,
  })
  return {
    ...rect,
    platform: plat === 'default' ? 'twitch' : plat,
    text: badgeOn || channelOn ? text : platMeta.label,
    showLogo,
    fontPx: Math.round((badgeGeom.fontPx ?? 32) * s),
    logoPx: Math.round((badgeGeom.logoPx ?? 40) * s),
    padX: Math.round((badgeGeom.padXPx ?? 22) * s),
    gap: Math.round((badgeGeom.gapPx ?? 12) * s),
    color: platMeta.color,
  }
}

export function resolveComposeSpec(edits: ClipEditsV2, playW = 1080, playH = 1920): ComposeSpec | null {
  if (!usesStreamHeadlineBandOverlay(edits)) return null
  const s = playH / 1920
  const tpl = normalizeExportTemplate(edits.exportTemplate)
  const layers = resolveLayers(edits)
  const hlLayer = layers.find((l): l is HeadlineLayer => l.id === 'headline' && l.type === 'headline')
  const text = formatHeadlineForExport(
    tpl?.headlineBar?.text?.trim() || tpl?.suggestedHeadline?.trim() || hlLayer?.text?.trim() || '',
  )
  const headlineOn = Boolean(tpl?.headlineBar?.enabled && text)
  const top = Math.round(geom.fitTop.headlineTop * s)

  let headline: ComposeSpec['headline'] = null
  let barH = 0
  if (headlineOn) {
    const st = resolveStreamHeadlineStyle(hlLayer)
    const boxW = Math.round((playW * st.widthPct) / 100)
    const fit = fitBoldNewsHeadline(text, st.font, {
      boxW: Math.floor(boxW * 0.94),
      maxBarH: Math.round(playH * 0.24),
      maxFontPx: Math.round(playW * 0.16),
      minFontPx: Math.round(40 * s),
      lineHeight: 1.04,
      padEm: 0.12,
      maxLines: 4,
    })
    barH = fit.barH
    headline = {
      x: Math.round((playW - boxW) / 2),
      y: top,
      w: boxW,
      h: barH,
      lines: fit.lines,
      fontPx: fit.fontPx,
      lineHeight: 1.04,
      font: st.font,
      textColor: st.textColor,
      boxColor: st.boxColor,
      radiusPx: st.radiusPx,
      preset: st.preset,
    }
  }
  const legacy = overlayLayout(2, playW, playH)
  const videoY = headlineOn ? top + barH : legacy.videoY
  let videoH = even(Math.round((playW * 9) / 16))
  if (videoY + videoH > playH) {
    videoH = even(playH - videoY - Math.round(geom.fitTop.videoBottomReservePx * s))
  }

  const badgeL = layers.find((l): l is BadgeLayer => l.id === 'badge' && l.type === 'badge' && l.enabled)
  const badge = badgeL ? buildBadgeSpec(edits, playW, playH, badgeL, videoY, videoH) : null

  const stickers = layers
    .filter((l): l is StickerLayer => l.type === 'sticker' && l.kind === 'follow_cta' && l.enabled)
    .map((l) => {
      const rect = stickerRectPx(playW, playH, l.x, l.y, l.anchor ?? 'center')
      return {
        ...rect,
        text: l.text || 'FOLLOW',
        color: l.platform === 'kick' ? '#53FC18' : '#9146FF',
        timing: (l.timing ?? 'always') as 'always' | 'intro' | 'outro',
        durationMs: l.durationMs ?? 3500,
      }
    })

  const cap = edits.captions ?? {}
  const preset = resolveCaptionPreset(cap)
  const capFont = cap.font?.trim() || (cap.presetConfig?.font as string | undefined) || preset.font
  const clamp = clampCaptionExportStyle(cap, playH)
  const assFontsize = Math.round((clamp.sizePct / 100) * playH)
  return {
    v: 1,
    kind: 'stream_band',
    playW,
    playH,
    bg: { kind: 'blur_cover', blurPx: 20, brightness: 0.92 },
    video: { x: 0, y: videoY, w: playW, h: videoH, fit: 'cover' },
    headline,
    badge,
    stickers,
    captions: {
      font: capFont,
      assFontsize,
      emPx: assFontsize * fontMetrics(capFont).assEmPerFontsize,
      maxLineWidthPx: Math.round(playW * 0.84),
      marginVPct: clamp.marginVPct,
      position: clamp.position,
    },
    zoom: { target: 'video' },
  }
}
