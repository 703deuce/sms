import { CAPTION_PRESETS, presetSlugToId, resolvePreset } from '@/lib/clips/caption-presets'
import {
  AI_CAPTIONS_DEFAULT_STYLE_ID,
  BUILTIN_STYLE_IDS,
  isBuiltinStyleId,
  type AiCaptionsStyle,
} from '@/lib/ai-captions/types'
import { AiCaptionsError } from '@/lib/ai-captions/errors'

export type SavedCaptionStyle = {
  styleId: string
  name: string
  basePresetId?: string | null
  config?: Record<string, unknown>
}

export function builtinStyles(): AiCaptionsStyle[] {
  const byId = new Map(CAPTION_PRESETS.map((p) => [presetSlugToId(p.slug), p]))
  return BUILTIN_STYLE_IDS.map((styleId) => {
    const preset = byId.get(styleId)
    return { styleId, name: preset?.name ?? styleId, kind: 'builtin' as const }
  })
}

export function combineStyles(saved: SavedCaptionStyle[]): AiCaptionsStyle[] {
  const builtins = builtinStyles()
  const ids = new Set(builtins.map((s) => s.styleId))
  const extra: AiCaptionsStyle[] = []
  for (const row of saved) {
    if (ids.has(row.styleId)) continue
    extra.push({ styleId: row.styleId, name: row.name, kind: 'saved' })
    ids.add(row.styleId)
  }
  return [...builtins, ...extra]
}

export function resolveRequestedStyleId(
  requested: string | undefined,
  lastStyleId: string | null,
  saved: SavedCaptionStyle[],
): string {
  const known = new Set<string>([...BUILTIN_STYLE_IDS, ...saved.map((s) => s.styleId)])
  if (requested) {
    if (!known.has(requested)) {
      throw new AiCaptionsError('unknown_style_id', 'That caption style is not available in this workspace.', 400)
    }
    return requested
  }
  if (lastStyleId && known.has(lastStyleId)) return lastStyleId
  return AI_CAPTIONS_DEFAULT_STYLE_ID
}

export function isKnownStyleId(styleId: string, saved: SavedCaptionStyle[]): boolean {
  return isBuiltinStyleId(styleId) || saved.some((s) => s.styleId === styleId)
}

export type AppliedCaptionStyle = {
  styleId: string
  presetId: string
  animation: string
  keywordHighlight: boolean
  autoEmojis: boolean
  customPresetId?: string
  presetConfig?: Record<string, unknown>
}

/** Default: clean_white, word highlight and auto-emoji off unless a saved style turns them on. */
export function applyStyleToCaptions(styleId: string, saved: SavedCaptionStyle[]): AppliedCaptionStyle {
  const row = saved.find((s) => s.styleId === styleId)
  if (row) {
    const cfg = row.config ?? {}
    const presetId =
      (typeof cfg.presetId === 'string' && cfg.presetId) ||
      row.basePresetId ||
      AI_CAPTIONS_DEFAULT_STYLE_ID
    const preset = resolvePreset(presetId)
    return {
      styleId,
      presetId,
      animation: typeof cfg.animation === 'string' ? cfg.animation : preset.animation,
      keywordHighlight: cfg.keywordHighlight === true,
      autoEmojis: cfg.autoEmojis === true,
      customPresetId: styleId,
      presetConfig: cfg,
    }
  }
  const preset = resolvePreset(styleId)
  return {
    styleId,
    presetId: styleId,
    animation: preset.animation,
    keywordHighlight: false,
    autoEmojis: false,
  }
}
