/**
 * EP1: the ONE badge-visibility rule — mirror of worker layers_spec.badge_render_state
 * (fixture: worker/tests/fixtures/render_plan/badge_cases.json, asserted by vitest + pytest).
 * The preview used `platformBadge.enabled || layer.showLabel`; the export draws the v3 sprite when the
 * badge layer is enabled with showLabel / showLink / showLogo, else (outside T6 template mode) the
 * legacy bar badge when platformBadge.enabled.
 */
import geom from '@/lib/clips/overlay-geometry.json'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { resolveLayers } from '@/lib/clips/layers'

export type BadgeRenderState = {
  on: boolean
  source: 'sprite' | 'legacy' | null
  platform: string | null
  showLabel: boolean
  showLogo: boolean
  text: string
}

const PLATS = (geom as unknown as { platforms: Record<string, { label?: string; color?: string }> }).platforms

export function platformLabel(platform: string): string {
  const p = (platform || '').toLowerCase()
  if (p === 'kick') return String(PLATS.kick?.label || 'KICK')
  if (p === 'twitch') return String(PLATS.twitch?.label || 'TWITCH')
  return String(PLATS.default?.label || 'LIVE')
}

export function platformColor(platform: string): string {
  const p = (platform || '').toLowerCase()
  if (p === 'kick') return String(PLATS.kick?.color || '#53FC18')
  if (p === 'twitch') return String(PLATS.twitch?.color || '#9146FF')
  return String(PLATS.default?.color || '#9146FF')
}

const OFF: BadgeRenderState = { on: false, source: null, platform: null, showLabel: false, showLogo: false, text: '' }

export function badgeRenderState(edits: ClipEditsV2, opts: { templateMode?: boolean } = {}): BadgeRenderState {
  let layer: Record<string, unknown> | undefined
  try {
    layer = resolveLayers(edits).find((l) => l.id === 'badge') as Record<string, unknown> | undefined
  } catch {
    layer = undefined
  }
  if (layer && layer.enabled && (layer.showLabel || layer.showLink || layer.showLogo)) {
    const platform = String(layer.platform || 'twitch')
    const showLabel = Boolean(layer.showLabel)
    const handle = String(layer.handle || layer.url || '').split('/').pop()!.slice(0, 24)
    const text = handle ? handle.toUpperCase() : platformLabel(platform)
    return { on: true, source: 'sprite', platform, showLabel, showLogo: Boolean(layer.showLogo), text: showLabel ? text : '' }
  }
  const tpl = (edits.exportTemplate ?? {}) as { platformBadge?: { enabled?: boolean }; platform?: string }
  if (!opts.templateMode && tpl.platformBadge?.enabled) {
    const platform = String(tpl.platform || 'twitch')
    return { on: true, source: 'legacy', platform, showLabel: true, showLogo: false, text: platformLabel(platform) }
  }
  return OFF
}
