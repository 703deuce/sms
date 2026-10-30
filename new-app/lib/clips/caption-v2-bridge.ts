import type { CaptionPresetV2 } from '@/lib/clips/caption-render-model'
import type { CaptionPreset } from '@/lib/clips/caption-presets'
import { resolveCaptionPreset, resolvePreset } from '@/lib/clips/caption-presets'
import { CAPTION_PRESETS_V2 } from '@/lib/clips/templates/registry'

export function mapV2PresetToLegacy(p: CaptionPresetV2): Record<string, unknown> {
  return {
    slug: p.id,
    name: p.name,
    font: p.font,
    weight: p.weight,
    case: p.case,
    wordsPerLine: p.wordsPerChunk,
    sizePct: (p.sizePx1920 / 1920) * 100,
    position: 'bottom',
    marginVPct: Math.round((1 - p.position.y) * 100),
    primary: p.fill,
    active: p.highlight.color,
    activeB: p.highlight.altColor,
    outline: p.stroke.color,
    outlineW: p.stroke.px,
    shadow: p.shadow.px,
    box: p.box
      ? {
          color: p.box.color,
          padX: p.box.padX,
          padY: p.box.padY,
          radius: p.box.radiusPx,
          opacity: (p.box as { opacity?: number }).opacity,
        }
      : null,
    animation: p.animation.kind === 'stomp' ? 'pop' : p.animation.kind,
    emphasisScale: 1.15,
    highlightMode: p.highlight.mode,
    animationMs: p.animation.ms,
  }
}

/** T6.2: keys that belong to the legacy preset and must not leak into a CP preset. Mirror of worker
 * captions_ass.CP_STALE_KEYS. */
export const CP_STALE_KEYS = [
  'presetConfig',
  'colors',
  'animation',
  'case',
  'wordsPerLine',
  'size',
  'sizePct',
  'font',
  'activeStyle',
  'highlightColor',
] as const

/**
 * T6.2: edits.captions for rendering. For CP presets the legacy keys (bold_pop presetConfig,
 * colors.a yellow, size 6.5, animation pop…) are dropped so preview == export. Non-CP presets
 * are returned unchanged.
 */
export function effectiveCaptionEdits<T extends { presetId?: string | null }>(cap: T, t6Enabled: boolean): T {
  const id = cap?.presetId?.trim() ?? ''
  if (!t6Enabled || !id.startsWith('cp')) return cap
  const out = { ...cap } as Record<string, unknown>
  for (const k of CP_STALE_KEYS) delete out[k]
  return out as T
}

export function resolveT6CaptionPreset(
  cap: { presetId?: string | null; presetConfig?: Record<string, unknown>; font?: string } | undefined,
  t6Enabled: boolean,
): CaptionPreset {
  const id = cap?.presetId?.trim() || 'bold_pop'
  if (t6Enabled && id.startsWith('cp')) {
    const raw = CAPTION_PRESETS_V2[id]
    if (raw && typeof raw === 'object') {
      const mapped = mapV2PresetToLegacy(raw as CaptionPresetV2) as CaptionPreset
      // T6.2: CP presets are self-contained — no presetConfig/font overrides (see effectiveCaptionEdits).
      return mapped
    }
  }
  return resolveCaptionPreset(cap)
}
