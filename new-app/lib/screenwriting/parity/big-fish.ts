import { paginateFromElements, layoutElementsFromPmJson } from '@/lib/screenwriting/layout'
import { FEATURE_FORMAT_SPEC } from '@/lib/screenwriting/formats/feature'
import type { JSONContent } from '@tiptap/core'

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
