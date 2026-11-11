import { findClipFont, type FontGlyphCoverage } from '@/lib/clips/font-manifest'

export const ASS_SCRIPT_FALLBACKS: Readonly<Record<FontGlyphCoverage, string>> = {
  latin: 'DejaVu Sans',
  greek: 'Noto Sans',
  cyrillic: 'Noto Sans',
  arabic: 'Noto Sans Arabic',
  devanagari: 'Noto Sans Devanagari',
  thai: 'Noto Sans Thai',
  cjk: 'Noto Sans CJK JP',
  emoji: 'Noto Sans',
}

const RE: Readonly<Record<FontGlyphCoverage, RegExp>> = {
  latin: /[A-Za-z\u00C0-\u024F]/u,
  greek: /[\u0370-\u03FF\u1F00-\u1FFF]/u,
  cyrillic: /[\u0400-\u052F]/u,
  arabic: /[\u0590-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u,
  devanagari: /[\u0900-\u097F]/u,
  thai: /[\u0E00-\u0E7F]/u,
  cjk: /[\u3040-\u30FF\u3400-\u4DBF\u4E00-\u9FFF]/u,
  emoji: /[\u2600-\u27BF\u{1F300}-\u{1FAFF}]/u,
}

const PRIORITY: readonly FontGlyphCoverage[] = ['arabic', 'devanagari', 'thai', 'cjk', 'greek', 'cyrillic', 'emoji', 'latin']

export function scriptsInText(text: string): FontGlyphCoverage[] {
  const value = String(text ?? '')
  return PRIORITY.filter(script => RE[script].test(value))
}

export function builtinFontSupportsText(fontId: string, text: string): boolean {
  const row = findClipFont(fontId)
  if (!row) return false
  const scripts = scriptsInText(text)
  return scripts.every(script => row.glyphCoverage.includes(script))
}

export function assFallbackForText(fontId: string, text: string): string {
  const row = findClipFont(fontId)
  if (row && builtinFontSupportsText(fontId, text)) return row.assFamily
  for (const script of scriptsInText(text)) {
    if (!row?.glyphCoverage.includes(script)) return ASS_SCRIPT_FALLBACKS[script]
  }
  return row?.fallback ?? 'DejaVu Sans'
}

export function cssFallbackStack(fontId: string): string {
  const row = findClipFont(fontId)
  const primary = row?.assFamily ?? fontId
  return [
    `"${primary.replace(/"/g, '')}"`,
    '"DejaVu Sans"',
    '"Noto Sans"',
    '"Noto Sans Arabic"',
    '"Noto Sans Devanagari"',
    '"Noto Sans Thai"',
    '"Noto Sans CJK JP"',
    '"Noto Color Emoji"',
    '"Apple Color Emoji"',
    '"Segoe UI Emoji"',
    'sans-serif',
  ].join(', ')
}
