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
        }
      : null,
    animation: p.animation.kind === 'stomp' ? 'pop' : p.animation.kind,
    emphasisScale: 1.15,
    highlightMode: p.highlight.mode,
    animationMs: p.animation.ms,
  }
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
      let base = cap?.font?.trim() ? { ...mapped, font: cap.font.trim() } : mapped
      const cfg = cap?.presetConfig
      if (cfg && typeof cfg === 'object') {
        const merged = { ...base } as Record<string, unknown>
        const allowed = ['font', 'primary', 'active', 'activeB', 'outline', 'outlineW', 'sizePct']
        for (const k of allowed) {
          const v = cfg[k]
          if (v !== null && v !== undefined && v !== '') merged[k] = v
        }
        base = merged as CaptionPreset
      }
      return base
    }
  }
  return resolveCaptionPreset(cap)
}
