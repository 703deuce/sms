import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defaultEdits, displayDurationMs, keepSegments, normalizeEdits, orderedKeepSegments } from '@/lib/clips/edits'
import { previewExportMatchesDefault } from '@/lib/clips/export-edits-match'

describe('default export path pin (TS)', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60000 }

  for (const file of ['regular.json', 'stream_v3_clipB.json'] as const) {
    it(`orderedKeepSegments equals keepSegments for ${file}`, () => {
      const raw = JSON.parse(
        readFileSync(join(__dirname, 'fixtures/export-dialog-edits', file), 'utf8'),
      )
      const edits =
        file === 'regular.json'
          ? normalizeEdits(defaultEdits(bounds), bounds)
          : normalizeEdits(raw, bounds)
      expect(orderedKeepSegments(edits)).toEqual(
        keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges),
      )
    })

    it(`displayDurationMs noop without speed for ${file}`, () => {
      const raw = JSON.parse(
        readFileSync(join(__dirname, 'fixtures/export-dialog-edits', file), 'utf8'),
      )
      const edits =
        file === 'regular.json'
          ? normalizeEdits(defaultEdits(bounds), bounds)
          : normalizeEdits(raw, bounds)
      expect(displayDurationMs(edits)).toBe(
        keepSegments(edits.trim.in, edits.trim.out, edits.cutRanges).reduce(
          (s, [a, b]) => s + (b - a),
          0,
        ),
      )
    })

    it(`preview guard false only when T4b fields set for ${file}`, () => {
      const raw = JSON.parse(
        readFileSync(join(__dirname, 'fixtures/export-dialog-edits', file), 'utf8'),
      )
      const edits =
        file === 'regular.json'
          ? normalizeEdits(defaultEdits(bounds), bounds)
          : normalizeEdits(raw, bounds)
      const base = previewExportMatchesDefault(edits, bounds)
      expect(previewExportMatchesDefault({ ...edits, loudnessLufs: -14 }, bounds)).toBe(false)
      expect(previewExportMatchesDefault({ ...edits, speed: 1.25 }, bounds)).toBe(false)
      expect(
        previewExportMatchesDefault(
          { ...edits, sectionOrder: [[30000, 60000], [0, 30000]] },
          bounds,
        ),
      ).toBe(false)
      expect(typeof base).toBe('boolean')
    })
  }
})
