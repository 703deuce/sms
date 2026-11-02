/**
 * Q4: non-Latin caption scripts — RTL detection, CJK-friendly fonts for ASS preview/export.
 * Mirror worker Noto bundle names (clips_worker/captions_ass.py).
 */

const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/
const CYRILLIC_RE = /[\u0400-\u04FF]/
const CJK_RE = /[\u3040-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/
const DEVANAGARI_RE = /[\u0900-\u097F]/
const THAI_RE = /[\u0E00-\u0E7F]/
const HEBREW_RE = /[\u0590-\u05FF]/

export function captionTextIsRtl(text: string): boolean {
  return RTL_RE.test(text)
}

/** ASS font name for mixed caption sample text (bounded; falls back when Latin-only). */
export function assFontForCaptionSample(text: string, fallback: string): string {
  const t = String(text ?? '')
  if (!t.trim()) return fallback
  if (HEBREW_RE.test(t) || /[\u0600-\u06FF]/.test(t)) return 'Noto Sans Arabic'
  if (DEVANAGARI_RE.test(t)) return 'Noto Sans Devanagari'
  if (THAI_RE.test(t)) return 'Noto Sans Thai'
  if (CJK_RE.test(t)) return 'Noto Sans CJK JP'
  if (CYRILLIC_RE.test(t)) return 'Noto Sans'
  return fallback
}

/** CJK line breaking prefers per-character chunks (max chars per line). */
export function cjkMaxCharsPerLine(text: string, defaultMax: number): number {
  return CJK_RE.test(text) ? Math.min(defaultMax, 12) : defaultMax
}
