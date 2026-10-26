import { paginateFromElements, layoutElementsFromPmJson } from '@/lib/screenwriting/layout'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import type { JSONContent } from '@tiptap/core'
import { fountainToPmJson } from '@/lib/screenwriting/fountain/convert'

/** In-repo golden subset (full Big Fish FDX optional via `scripts/sw-fetch-fixtures.sh`). */
export const BIG_FISH_MINI_FOUNTAIN = `FADE IN:\n\nINT. BEDROOM - DAY\n\nHe wakes.\n`

export function bigFishGoldenDoc(): JSONContent {
  return fountainToPmJson(BIG_FISH_MINI_FOUNTAIN)
}

export function pageStartAnchors(doc: JSONContent): string[] {
  const layout = paginateFromElements(layoutElementsFromPmJson(doc), {
    spec: FEATURE_FORMAT_SPEC,
    bodyLinesPerPage: 54,
  })
  return layout.pages.map((p) => p.lines.find((l) => !l.virtual)?.text ?? '')
}

export function parityScorePercent(expected: string[], actual: string[]): number {
  if (!expected.length) return 100
  let match = 0
  for (let i = 0; i < expected.length && i < actual.length; i++) {
    if (expected[i].trim() === actual[i].trim()) match++
  }
  return Math.round((match / expected.length) * 100)
}

export function runBigFishParitySelfCheck(doc: JSONContent): {
  score: number
  pass: boolean
  expected: string[]
  actual: string[]
} {
  const golden = bigFishGoldenDoc()
  const expected = pageStartAnchors(golden).filter(Boolean)
  const actual = pageStartAnchors(doc).filter(Boolean)
  const score = parityScorePercent(expected, actual)
  return { score, pass: score >= 100, expected, actual: actual.slice(0, expected.length) }
}
