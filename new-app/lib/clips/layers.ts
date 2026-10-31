import { z } from 'zod'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { headlineLayerPlacement } from '@/lib/clips/headline-band-layout'
import { headlineStyleForPreset } from '@/lib/clips/overlay-geometry'

const layerBaseSchema = z.object({
  id: z.string(),
  enabled: z.boolean(),
  z: z.number(),
  startMs: z.number().optional(),
  endMs: z.number().optional(),
})

const headlineLayerSchema = layerBaseSchema.extend({
  type: z.literal('headline'),
  text: z.string(),
  suggested: z.string().optional(),
  placement: z.enum(['fit_top_band', 'export_bar']),
  style: z.object({
    preset: z.enum(['stream_white_box', 'export_bar', 'stream_yellow', 'export_bar_dark', 'bold_news']),
    font: z.string().optional(),
    textColor: z.string(),
    boxColor: z.string(),
    radiusPx: z.number(),
    widthPct: z.number(),
    maxLines: z.number(),
  }),
})

const badgeLayerSchema = layerBaseSchema.extend({
  type: z.literal('badge'),
  platform: z.enum(['twitch', 'kick', 'none']),
  handle: z.string().optional(),
  url: z.string().optional(),
  showLabel: z.boolean(),
  showLink: z.boolean(),
  showLogo: z.boolean().default(false),
  placement: z.enum(['fit_top_band', 'export_bar']),
})

const stickerLayerSchema = layerBaseSchema.extend({
  type: z.literal('sticker'),
  kind: z.literal('follow_cta'),
  text: z.string(),
  platform: z.enum(['twitch', 'kick']).optional(),
  x: z.number(),
  y: z.number(),
  anchor: z.enum(['TL', 'TR', 'BL', 'BR']).optional(),
  timing: z.enum(['always', 'intro', 'outro']).optional(),
  durationMs: z.number().int().min(500).max(30_000).optional(),
})

const captionsLayerSchema = layerBaseSchema.extend({
  type: z.literal('captions'),
  settings: z.record(z.unknown()),
})

const chatLayerSchema = layerBaseSchema.extend({
  type: z.literal('chat'),
  position: z.enum(['gameplay_right', 'gameplay_left', 'bottom']),
  opacity: z.number(),
})

const logoLayerSchema = layerBaseSchema.extend({
  type: z.literal('logo'),
  logoKey: z.string(),
  position: z.string(),
  sizePct: z.number(),
  opacity: z.number(),
})

const progressBarLayerSchema = layerBaseSchema.extend({
  type: z.literal('progressBar'),
  color: z.string(),
  position: z.enum(['top', 'bottom']),
  thickness: z.number(),
})

const hookLayerSchema = layerBaseSchema.extend({
  type: z.literal('hook'),
  text: z.string(),
  durationMs: z.number(),
  color: z.string().optional(),
})

export const layerSchema = z.discriminatedUnion('type', [
  headlineLayerSchema,
  badgeLayerSchema,
  stickerLayerSchema,
  captionsLayerSchema,
  chatLayerSchema,
  logoLayerSchema,
  progressBarLayerSchema,
  hookLayerSchema,
])

export const layersSchema = z.array(layerSchema)

export const templateV3Schema = z.object({
  v: z.literal(3),
  name: z.string().optional(),
  layout: z.object({
    mode: z.string(),
    facecamPosition: z.enum(['top', 'bottom']).optional(),
    pipCorner: z.enum(['TL', 'TR', 'BL', 'BR']).optional(),
  }),
  layers: layersSchema,
})

export type HeadlineLayer = z.infer<typeof headlineLayerSchema>
export type BadgeLayer = z.infer<typeof badgeLayerSchema>
export type StickerLayer = z.infer<typeof stickerLayerSchema>
export type CaptionsLayer = z.infer<typeof captionsLayerSchema>
export type ChatLayer = z.infer<typeof chatLayerSchema>
export type LogoLayer = z.infer<typeof logoLayerSchema>
export type ProgressBarLayer = z.infer<typeof progressBarLayerSchema>
export type HookLayer = z.infer<typeof hookLayerSchema>
export type Layer = z.infer<typeof layerSchema>
export type TemplateV3 = z.infer<typeof templateV3Schema>

function layoutMode(edits: ClipEditsV2): string {
  return edits.layout?.mode ?? 'speaker_follow'
}

function placement(edits: ClipEditsV2): 'fit_top_band' | 'export_bar' {
  return headlineLayerPlacement(layoutMode(edits))
}

export function handleFromUrl(url: string): string | undefined {
  const u = url.trim()
  if (!u) return undefined
  try {
    const path = new URL(u, 'https://placeholder.invalid').pathname || u
    const seg = path.replace(/\/+$/, '').split('/').pop()
    return seg || undefined
  } catch {
    const seg = u.replace(/\/+$/, '').split('/').pop()
    return seg || undefined
  }
}

export function layersFromLegacy(edits: ClipEditsV2): Layer[] {
  const out: Layer[] = []
  const tpl = edits.exportTemplate
  const hb = tpl?.headlineBar
  const place = placement(edits)
  const headlineZ = place === 'fit_top_band' ? 5 : 70
  out.push({
    id: 'headline',
    type: 'headline',
    enabled: Boolean(hb?.enabled),
    z: headlineZ,
    text: String(hb?.text ?? ''),
    suggested: tpl?.suggestedHeadline ? String(tpl.suggestedHeadline) : undefined,
    placement: place,
    style: (() => {
      const preset = place === 'fit_top_band' ? 'stream_white_box' : 'export_bar'
      const colors = headlineStyleForPreset(preset)
      return {
        preset,
        textColor: colors.textColor,
        boxColor: colors.boxColor,
        radiusPx: colors.radiusPx,
        widthPct: 100,
        maxLines: place === 'fit_top_band' ? 4 : 3,
      }
    })(),
  })

  const badgeOn = Boolean(tpl?.platformBadge?.enabled)
  const linkOn = Boolean(tpl?.channelLink?.enabled)
  if (badgeOn || linkOn) {
    const url = String(tpl?.channelLink?.url ?? '')
    const plat = (tpl?.platform as 'twitch' | 'kick' | 'none') || 'twitch'
    out.push({
      id: 'badge',
      type: 'badge',
      enabled: true,
      z: place === 'fit_top_band' ? 6 : 71,
      platform: plat === 'kick' ? 'kick' : plat === 'none' ? 'none' : 'twitch',
      handle: handleFromUrl(url),
      url: url || undefined,
      showLabel: badgeOn,
      showLink: linkOn,
      showLogo: false,
      placement: place,
    })
  }

  const cap = edits.captions ?? {}
  out.push({
    id: 'captions',
    type: 'captions',
    enabled: cap.enabled !== false,
    z: 20,
    settings: { ...cap } as ClipEditsV2['captions'],
  })

  const brand = edits.brand as Record<string, unknown> | undefined
  if (brand?.logoKey) {
    out.push({
      id: 'logo',
      type: 'logo',
      enabled: true,
      z: 30,
      logoKey: String(brand.logoKey),
      position: String(brand.logoPosition ?? 'TR'),
      sizePct: Number(brand.logoSizePct ?? 12),
      opacity: Number(brand.logoOpacity ?? 0.9),
    })
  }

  const ho = edits.hookOverlay
  if (ho?.enabled && String(ho.text ?? '').trim()) {
    const primary =
      brand && typeof brand.primaryColor === 'string' ? brand.primaryColor : '#FACC15'
    out.push({
      id: 'hook',
      type: 'hook',
      enabled: true,
      z: 40,
      text: String(ho.text ?? ''),
      durationMs: Number(ho.durationMs ?? 2500),
      color: primary,
    })
  }

  const pb = cap.progressBar
  if (pb?.enabled) {
    out.push({
      id: 'progressBar',
      type: 'progressBar',
      enabled: true,
      z: 80,
      color: String(pb.color ?? '#FFFFFF'),
      position: (pb.position as 'top' | 'bottom') ?? 'bottom',
      thickness: Number(pb.thickness ?? 8),
    })
  }

  const chat = edits.chatOverlay
  if (chat?.enabled) {
    out.push({
      id: 'chat',
      type: 'chat',
      enabled: true,
      z: 90,
      position: chat.position ?? 'gameplay_right',
      opacity: Number(chat.opacity ?? 0.85),
    })
  }

  return out.sort((a, b) => a.z - b.z)
}

const V3_EXTRA_LAYER_TYPES = new Set(['sticker'])

function mergeHeadlineLayer(fresh: HeadlineLayer, stored: HeadlineLayer | undefined): HeadlineLayer {
  if (!stored || stored.type !== 'headline') return fresh
  return {
    ...fresh,
    style: { ...fresh.style, ...stored.style },
  }
}

function mergeBadgeLayer(
  fresh: BadgeLayer | undefined,
  stored: BadgeLayer | undefined,
  edits: ClipEditsV2,
): BadgeLayer | null {
  const tpl = edits.exportTemplate
  const badgeOn = Boolean(tpl?.platformBadge?.enabled)
  const linkOn = Boolean(tpl?.channelLink?.enabled)
  const place = placement(edits)
  const z = place === 'fit_top_band' ? 6 : 71
  const platform = (tpl?.platform as BadgeLayer['platform']) || 'twitch'
  const url = String(tpl?.channelLink?.url ?? '')

  if (fresh && fresh.type === 'badge') {
    return {
      ...fresh,
      showLogo: stored?.showLogo ?? fresh.showLogo,
      // EP1: a stored handle wins (worker layers_spec._merge_sync_layer) — the preview badge read
      // "TWITCH" while the export burned the saved handle ("2XRAKAI").
      handle: stored?.handle || fresh.handle,
    }
  }

  if (!stored || stored.type !== 'badge') return fresh ?? null

  if (!badgeOn && !linkOn) {
    if (stored.showLogo || stored.enabled) {
      return {
        ...stored,
        enabled: false,
        showLabel: false,
        showLink: false,
        showLogo: stored.showLogo,
        handle: stored.handle ?? handleFromUrl(url),
        platform: stored.platform ?? platform,
        placement: place,
        z,
      }
    }
    return null
  }

  return fresh ?? null
}

function mergeMappedLayer(fresh: Layer, stored: Layer | undefined): Layer {
  if (fresh.type === 'headline') return mergeHeadlineLayer(fresh, stored as HeadlineLayer | undefined)
  if (fresh.type === 'captions') return fresh
  return fresh
}

export function syncLayersFromLegacy(
  edits: ClipEditsV2 & { layersV?: number; layers?: unknown },
): ClipEditsV2 & { layersV?: number; layers?: unknown } {
  if (edits.layersV !== 3) return edits
  const fresh = layersFromLegacy(edits)
  const stored = validateLayers(edits.layers) ?? []
  const storedById = new Map(stored.map((l) => [l.id, l]))
  const merged: Layer[] = []

  for (const freshLayer of fresh) {
    if (freshLayer.type === 'badge') {
      const badge = mergeBadgeLayer(freshLayer, storedById.get('badge') as BadgeLayer | undefined, edits)
      if (badge) merged.push(badge)
      continue
    }
    merged.push(mergeMappedLayer(freshLayer, storedById.get(freshLayer.id)))
  }

  const freshIds = new Set(fresh.map((l) => l.id))
  if (!freshIds.has('badge')) {
    const orphanBadge = mergeBadgeLayer(undefined, storedById.get('badge') as BadgeLayer | undefined, edits)
    if (orphanBadge) merged.push(orphanBadge)
  }

  for (const layer of stored) {
    if (V3_EXTRA_LAYER_TYPES.has(layer.type)) merged.push(layer)
  }

  merged.sort((a, b) => a.z - b.z)
  return { ...edits, layers: merged }
}

export function v3HasExtras(layers: Layer[]): boolean {
  for (const layer of layers) {
    if (!layer.enabled) continue
    if (layer.type === 'sticker') return true
    if (layer.type === 'badge' && layer.showLogo) return true
  }
  return false
}

const MAPPED_KEYS = ['exportTemplate', 'captions', 'brand', 'hookOverlay', 'chatOverlay'] as const

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson)
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(o).sort()) out[k] = sortJson(o[k])
    return out
  }
  return value
}

export function canonicalLayersJSON(layers: Layer[]): string {
  return JSON.stringify(sortJson(layers))
}

function layerById(layers: Layer[], id: string): Layer | undefined {
  return layers.find((l) => l.id === id)
}

export function legacyFromLayers(layers: Layer[], edits: ClipEditsV2): ClipEditsV2 {
  const out: ClipEditsV2 = { ...edits }
  const hl = layerById(layers, 'headline')
  const badge = layerById(layers, 'badge')
  const capL = layerById(layers, 'captions')
  const logoL = layerById(layers, 'logo')
  const hookL = layerById(layers, 'hook')
  const pbL = layerById(layers, 'progressBar')
  const chatL = layerById(layers, 'chat')

  const tpl = { ...(out.exportTemplate ?? {}) }
  const hadTpl = Boolean(out.exportTemplate)
  let tplDirty = false
  if (hl && hl.type === 'headline') {
    tpl.headlineBar = {
      ...(tpl.headlineBar ?? {}),
      enabled: hl.enabled,
      text: hl.text,
    }
    if (hl.suggested) tpl.suggestedHeadline = hl.suggested
    tplDirty = hadTpl || hl.enabled || Boolean(hl.text.trim())
  }
  if (badge && badge.type === 'badge') {
    tpl.platformBadge = { ...(tpl.platformBadge ?? {}), enabled: badge.showLabel }
    tpl.channelLink = {
      ...(tpl.channelLink ?? {}),
      enabled: badge.showLink,
      url: badge.url ?? '',
    }
    tpl.platform = badge.platform
    tplDirty = true
  }
  if (tplDirty && Object.keys(tpl).length) out.exportTemplate = tpl

  if (capL && capL.type === 'captions') {
    const settings = { ...(capL.settings as ClipEditsV2['captions']) }
    if (pbL && pbL.type === 'progressBar') {
      settings.progressBar = {
        enabled: pbL.enabled,
        color: pbL.color,
        position: pbL.position,
        thickness: pbL.thickness,
      }
    }
    out.captions = settings
  }

  if (logoL && logoL.type === 'logo') {
    out.brand = {
      ...(typeof out.brand === 'object' && out.brand ? out.brand : {}),
      logoKey: logoL.logoKey,
      logoPosition: logoL.position,
      logoSizePct: logoL.sizePct,
      logoOpacity: logoL.opacity,
    }
  }

  if (hookL && hookL.type === 'hook') {
    out.hookOverlay = {
      enabled: hookL.enabled,
      text: hookL.text,
      durationMs: hookL.durationMs,
    }
  }

  if (chatL && chatL.type === 'chat') {
    out.chatOverlay = {
      enabled: chatL.enabled,
      position: chatL.position,
      opacity: chatL.opacity,
    }
  }

  return out
}

function validateLayers(raw: unknown): Layer[] | null {
  const parsed = layersSchema.safeParse(raw)
  if (!parsed.success) return null
  return parsed.data
}

export function resolveLayers(edits: ClipEditsV2 & { layersV?: number; layers?: unknown }): Layer[] {
  const synced = syncLayersFromLegacy(edits)
  if (synced.layersV === 3 && Array.isArray(synced.layers)) {
    const parsed = validateLayers(synced.layers)
    if (parsed) return parsed
  }
  return layersFromLegacy(synced)
}

export function parseTemplateV3(settings: unknown): TemplateV3 | null {
  if (!settings || typeof settings !== 'object') return null
  const raw = (settings as Record<string, unknown>).templateV3
  const parsed = templateV3Schema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function mappedEditsSubset(edits: ClipEditsV2): Pick<ClipEditsV2, (typeof MAPPED_KEYS)[number]> {
  const out: Partial<ClipEditsV2> = {}
  for (const key of MAPPED_KEYS) {
    if (edits[key] !== undefined) (out as Record<string, unknown>)[key] = edits[key]
  }
  return out as Pick<ClipEditsV2, (typeof MAPPED_KEYS)[number]>
}
