/**
 * Workspace caption-preset config (PRODUCT_V1 Track B).
 * Matches the frontend v1 snapshot posted to POST /api/clips/caption-presets.
 * Intentionally excludes per-clip text: emojiByWord and emphasis indices.
 */

export const CAPTION_STYLE_SNAPSHOT_VERSION = 1 as const

export const CAPTION_STYLE_SNAPSHOT_KEYS = [
  'enabled',
  'presetId',
  'font',
  'animation',
  'size',
  'userSizePct',
  'position',
  'case',
  'wordsPerLine',
  'colors',
  'keywordHighlight',
  'autoEmojis',
  'progressBar',
  'presetConfig',
  'customPresetId',
  'marginVPct',
  'activeStyle',
  'highlightColor',
] as const

const EXCLUDED_CLIP_TEXT_KEYS = ['emojiByWord', 'emphasis', 'captionLines', 'wordFixes', 'wordFixMeta'] as const

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Keep the published v1 style contract, drop per-clip text fields, and leave
 * unknown future brand-kit keys intact so New #2 can extend this shape.
 */
export function normalizeCaptionPresetConfig(raw: unknown): Record<string, unknown> {
  const src = isRecord(raw) ? { ...raw } : {}
  for (const key of EXCLUDED_CLIP_TEXT_KEYS) delete src[key]
  const version = src.version === CAPTION_STYLE_SNAPSHOT_VERSION ? CAPTION_STYLE_SNAPSHOT_VERSION : src.version
  if (version === undefined) src.version = CAPTION_STYLE_SNAPSHOT_VERSION
  if (src.activeStyle !== undefined && src.activeStyle !== 'color' && src.activeStyle !== 'highlight' && src.activeStyle !== 'fill') {
    delete src.activeStyle
  }
  return src
}
