import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderTimingSpec } from '@/lib/clips/editor/clip-timeline'
import type { ClipEditsV2 } from '@/lib/clips/edits'

/**
 * Preview/export parity: the same JSON fixture is asserted by the worker
 * (worker/tests/test_timeline_lanes.py → timeline_render_spec). If either side drifts, one fails.
 */
const here = path.dirname(fileURLToPath(import.meta.url))
const fixture = JSON.parse(
  readFileSync(path.resolve(here, '../../worker/tests/fixtures/timeline_parity.json'), 'utf8'),
) as { cases: { name: string; edits: Record<string, unknown>; expected: unknown }[] }

describe('timeline render timing parity (web ↔ worker fixture)', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      const edits = { cutRanges: [], wordFixes: {}, ...c.edits } as unknown as ClipEditsV2
      expect(renderTimingSpec(edits)).toEqual(c.expected)
    })
  }
})
