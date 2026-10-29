import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  defaultEdits,
  normalizeEdits,
  normalizeSectionOrder,
  orderedKeepSegments,
  type ClipEditsV2,
} from '@/lib/clips/edits'
import { moveSelection } from '@/lib/clips/editor/reorder'

const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/reorder_cases.json'), 'utf8'),
) as {
  cases: Array<{
    name: string
    trimIn: number
    trimOut: number
    cutRanges: [number, number][]
    sectionOrder: [number, number][] | null
    expectSegments?: [number, number][]
    expectNormalizeUndefined?: boolean
    expectInvalid?: boolean
  }>
}

function editsForCase(c: (typeof fixture.cases)[0]): ClipEditsV2 {
  const bounds = { clipStartMs: 0, clipEndMs: c.trimOut }
  return normalizeEdits(
    {
      ...defaultEdits(bounds),
      trim: { in: c.trimIn, out: c.trimOut },
      cutRanges: c.cutRanges,
      sectionOrder: c.sectionOrder ?? undefined,
    },
    bounds,
  )
}

describe('reorder fixture parity', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const norm = normalizeSectionOrder(c.sectionOrder, c.trimIn, c.trimOut)
      if (c.expectInvalid) {
        expect(norm).toBeUndefined()
        return
      }
      if (c.expectNormalizeUndefined) {
        expect(norm).toBeUndefined()
      }
      const edits = editsForCase(c)
      const segs = orderedKeepSegments(edits)
      expect(segs).toEqual(c.expectSegments)
    })
  }
})

describe('moveSelection', () => {
  it('returns null when selection spans blocks', () => {
    const bounds = { clipStartMs: 0, clipEndMs: 10000 }
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const withOrder = normalizeEdits(
      { ...edits, sectionOrder: [[5000, 10000], [0, 5000]] },
      bounds,
    )
    const words = [
      { startMs: 100, endMs: 900 },
      { startMs: 5100, endMs: 5900 },
    ]
    expect(moveSelection(withOrder, [4000, 6000], 'up', words)).toBeNull()
  })
})
