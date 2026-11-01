import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import { sourceMsToEditorMs } from '@/lib/clips/editor/source-ms-to-editor'
import {
  buildTimestampedLines,
  chaptersToMarkers,
  formatYoutubeChapters,
  normalizeChapters,
} from '@/lib/clips/repurpose'

describe('sourceMsToEditorMs', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 60_000 }
  it('identity with no cuts', () => {
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const tb = timebaseFor(edits)
    expect(sourceMsToEditorMs(tb, 5000)).toEqual({ ms: 5000, wasCut: false })
  })
})

describe('repurpose helpers', () => {
  const bounds = { clipStartMs: 0, clipEndMs: 120_000 }
  const edits = normalizeEdits(defaultEdits(bounds), bounds)
  const lines = buildTimestampedLines(
    [
      { w: 'Hello', startMs: 0, endMs: 500, confidence: 1 },
      { w: 'world.', startMs: 500, endMs: 1000, confidence: 1 },
    ],
    edits,
  )

  it('normalizeChapters forces intro at 0', () => {
    const norm = normalizeChapters(
      {
        chapters: [
          { line: 0, label: 'A' },
          { line: 0, label: 'B' },
          { line: 0, label: 'C' },
        ],
      },
      [
        { line: 0, outMs: 0, text: 'a' },
        { line: 1, outMs: 15_000, text: 'b' },
        { line: 2, outMs: 30_000, text: 'c' },
      ],
      120_000,
    )
    expect('chapters' in norm).toBe(true)
    if ('chapters' in norm) expect(norm.chapters[0]?.outMs).toBe(0)
  })

  it('formatYoutubeChapters', () => {
    expect(formatYoutubeChapters([{ outMs: 65000, label: 'Mid' }])).toContain('1:05')
  })

  it('chaptersToMarkers skips duplicate ms', () => {
    const withM = chaptersToMarkers({ ...edits, markers: [{ id: 'm1', ms: 0, color: 'blue' }] }, [
      { outMs: 0, label: 'Intro' },
      { outMs: 30_000, label: 'Part' },
    ])
    expect(withM.markers?.length).toBeGreaterThan(1)
  })
})
