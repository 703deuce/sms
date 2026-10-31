import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { audioSegments, normalizeSplitEdits, splitOffsets } from '@/lib/clips/editor/split-edits'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/g1b3_parity.json')

describe('G1b3 J / L parity fixture (worker split_edits.py asserts the same)', () => {
  const fx = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')) as {
    split_cases: { segs: [number, number][]; splits: unknown; trim: [number, number]; offsets: number[]; audio: [number, number][] }[]
  }
  fx.split_cases.forEach((c, i) => {
    it(`case ${i}`, () => {
      const o = splitOffsets(c.segs, normalizeSplitEdits(c.splits), c.trim[0], c.trim[1])
      expect(o).toEqual(c.offsets)
      expect(audioSegments(c.segs, o)).toEqual(c.audio)
    })
  })
})
