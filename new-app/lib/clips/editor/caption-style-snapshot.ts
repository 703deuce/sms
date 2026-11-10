import type { ClipEditsV2 } from '../edits'

/** Workspace-reusable caption style (seed for brand kit). Clip text/timings are not included. */
export const CAPTION_STYLE_SNAPSHOT_VERSION = 1 as const

export type CaptionStyleSnapshot = {
  version: typeof CAPTION_STYLE_SNAPSHOT_VERSION
  enabled?: boolean
  presetId?: string
  font?: string
  animation?: string
  size?: number
  userSizePct?: number
  position?: string
  case?: string
  wordsPerLine?: number
  colors?: { a?: string; b?: string }
  keywordHighlight?: boolean
  autoEmojis?: boolean
  progressBar?: ClipEditsV2['captions']['progressBar']
  presetConfig?: Record<string, unknown>
  customPresetId?: string
  marginVPct?: number
  activeStyle?: ClipEditsV2['captions']['activeStyle']
  highlightColor?: string
}

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

export type CaptionStyleSnapshotKey = (typeof CAPTION_STYLE_SNAPSHOT_KEYS)[number]

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

function pickColors(raw: unknown): { a?: string; b?: string } | undefined {
  if (!isRecord(raw)) return undefined
  const a = typeof raw.a === 'string' && raw.a.trim() ? raw.a : undefined
  const b = typeof raw.b === 'string' && raw.b.trim() ? raw.b : undefined
  if (!a && !b) return undefined
  return { ...(a ? { a } : {}), ...(b ? { b } : {}) }
}

function pickProgressBar(raw: unknown): ClipEditsV2['captions']['progressBar'] | undefined {
  if (!isRecord(raw)) return undefined
  const enabled = raw.enabled === true
  const color = typeof raw.color === 'string' ? raw.color : undefined
  const position = raw.position === 'top' || raw.position === 'bottom' ? raw.position : undefined
  const thickness = typeof raw.thickness === 'number' && Number.isFinite(raw.thickness) ? raw.thickness : undefined
  if (!enabled && !color && !position && thickness === undefined) return undefined
  return {
    enabled,
    ...(color ? { color } : {}),
    ...(position ? { position } : {}),
    ...(thickness !== undefined ? { thickness } : {}),
  }
}

function pickPresetConfig(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined || v === '') continue
    out[k] = v
  }
  return Object.keys(out).length ? out : undefined
}

/** Accept today's incomplete saved configs and a full v1 snapshot. */
export function normalizeCaptionStyleSnapshot(raw: unknown): CaptionStyleSnapshot {
  const src = isRecord(raw) ? raw : {}
  const activeStyle =
    src.activeStyle === 'color' || src.activeStyle === 'highlight' || src.activeStyle === 'fill'
      ? src.activeStyle
      : undefined
  const snapshot: CaptionStyleSnapshot = { version: CAPTION_STYLE_SNAPSHOT_VERSION }
  if (typeof src.enabled === 'boolean') snapshot.enabled = src.enabled
  if (typeof src.presetId === 'string' && src.presetId.trim()) snapshot.presetId = src.presetId.trim()
  if (typeof src.font === 'string' && src.font.trim()) snapshot.font = src.font.trim()
  if (typeof src.animation === 'string' && src.animation.trim()) snapshot.animation = src.animation.trim()
  if (typeof src.size === 'number' && Number.isFinite(src.size)) snapshot.size = src.size
  if (typeof src.userSizePct === 'number' && Number.isFinite(src.userSizePct)) snapshot.userSizePct = src.userSizePct
  if (typeof src.position === 'string' && src.position.trim()) snapshot.position = src.position.trim()
  if (typeof src.case === 'string' && src.case.trim()) snapshot.case = src.case.trim()
  if (typeof src.wordsPerLine === 'number' && Number.isFinite(src.wordsPerLine)) snapshot.wordsPerLine = src.wordsPerLine
  const colors = pickColors(src.colors)
  if (colors) snapshot.colors = colors
  if (typeof src.keywordHighlight === 'boolean') snapshot.keywordHighlight = src.keywordHighlight
  if (typeof src.autoEmojis === 'boolean') snapshot.autoEmojis = src.autoEmojis
  const progressBar = pickProgressBar(src.progressBar)
  if (progressBar) snapshot.progressBar = progressBar
  const presetConfig = pickPresetConfig(src.presetConfig)
  if (presetConfig) snapshot.presetConfig = presetConfig
  if (typeof src.customPresetId === 'string' && src.customPresetId.trim()) {
    snapshot.customPresetId = src.customPresetId.trim()
  }
  if (typeof src.marginVPct === 'number' && Number.isFinite(src.marginVPct)) snapshot.marginVPct = src.marginVPct
  if (activeStyle) snapshot.activeStyle = activeStyle
  if (typeof src.highlightColor === 'string' && src.highlightColor.trim()) {
    snapshot.highlightColor = src.highlightColor.trim()
  }
  return snapshot
}

export function buildCaptionStyleSnapshot(cap: ClipEditsV2['captions'] | undefined): CaptionStyleSnapshot {
  return normalizeCaptionStyleSnapshot(cap ?? {})
}

/**
 * Re-apply a saved workspace style onto another clip's captions.
 * Word fixes, caption line text, and emphasis indices are left untouched.
 */
export function applyCaptionStyleSnapshot(
  current: ClipEditsV2['captions'] | undefined,
  raw: unknown,
): ClipEditsV2['captions'] {
  const snap = normalizeCaptionStyleSnapshot(raw)
  const next: Record<string, unknown> = { ...(current ?? {}) }
  // Merge defined snapshot fields over the current style. Omitted keys from
  // a legacy incomplete saved config keep the clip's existing values (e.g. font)
  // instead of wiping them to undefined.
  const assigned = snap as Record<string, unknown>
  for (const key of CAPTION_STYLE_SNAPSHOT_KEYS) {
    const value = assigned[key]
    if (value !== undefined) next[key] = value
  }
  return next as ClipEditsV2['captions']
}

export function captionStyleSnapshotForSave(cap: ClipEditsV2['captions'] | undefined): Record<string, unknown> {
  const snap = buildCaptionStyleSnapshot(cap)
  const out: Record<string, unknown> = { ...snap }
  return out
}
