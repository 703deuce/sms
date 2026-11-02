import { describe, expect, it } from 'vitest'
import { assembleMainSelects, SELECT_HANDLE_MS, hitToSelectPayload } from '@/lib/clips/editor/project-selects'
import { defaultEdits, outputDurationMs } from '@/lib/clips/edits'
import { snapTranscriptSelectionMs } from '@/lib/clips/editor/make-clip-from-transcript'
import { FREE_THUMB_OVERLAY_PRESETS } from '@/lib/clips/editor/free-thumbnail'
import { clampPickDrag } from '@/lib/clips/editor/highlights'

describe('Q5 TB-12 project selects', () => {
  it('hitToSelectPayload maps speech hit ms', () => {
    const p = hitToSelectPayload({
      sourceId: 'main',
      kind: 'main',
      label: 'Main',
      startS: 10,
      endS: 12,
      snippet: 'hello world',
    })
    expect(p.startMs).toBe(10_000)
    expect(p.endMs).toBe(12_000)
  })

  it('assembleMainSelects applies 0.5s handles and cuts gaps in bin order', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 120_000 })
    const out = assembleMainSelects(
      edits,
      [
        {
          id: 'a',
          sourceId: 'main',
          kind: 'main',
          label: 'A',
          startMs: 10_000,
          endMs: 12_000,
          snippet: null,
          sortOrder: 0,
        },
        {
          id: 'b',
          sourceId: 'main',
          kind: 'main',
          label: 'B',
          startMs: 20_000,
          endMs: 22_000,
          snippet: null,
          sortOrder: 1,
        },
      ],
      { sourceDurationMs: 120_000 },
    )
    expect(out).not.toBeNull()
    expect(out!.trim.in).toBe(10_000 - SELECT_HANDLE_MS)
    expect(out!.trim.out).toBe(22_000 + SELECT_HANDLE_MS)
    expect(out!.cutRanges.some(([s, e]) => s >= 12_500 && e <= 19_500)).toBe(true)
  })

  it('assembleMainSelects uses sectionOrder when bin order differs from time', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 120_000 })
    const out = assembleMainSelects(
      edits,
      [
        {
          id: 'b',
          sourceId: 'main',
          kind: 'main',
          label: 'B',
          startMs: 20_000,
          endMs: 22_000,
          snippet: null,
          sortOrder: 0,
        },
        {
          id: 'a',
          sourceId: 'main',
          kind: 'main',
          label: 'A',
          startMs: 10_000,
          endMs: 12_000,
          snippet: null,
          sortOrder: 1,
        },
      ],
    )
    expect(out?.sectionOrder?.[0]).toEqual([20_000 - SELECT_HANDLE_MS, 22_000 + SELECT_HANDLE_MS])
  })

  it('two short main selects yield ~2s output (handles + min span, gaps cut)', () => {
    const edits = defaultEdits({ clipStartMs: 0, clipEndMs: 60_000 })
    const out = assembleMainSelects(
      edits,
      [
        {
          id: 'a',
          sourceId: 'main',
          kind: 'main',
          label: 'A',
          startMs: 1000,
          endMs: 1300,
          snippet: null,
          sortOrder: 0,
        },
        {
          id: 'b',
          sourceId: 'main',
          kind: 'main',
          label: 'B',
          startMs: 5000,
          endMs: 5300,
          snippet: null,
          sortOrder: 1,
        },
      ],
      { sourceDurationMs: 60_000 },
    )
    expect(out).not.toBeNull()
    const dur = outputDurationMs(out!)
    // Each block: (end+500)-(start-500) => 1300ms; gap 1800–4500 removed => ~2600ms (not full trim span).
    expect(dur).toBeGreaterThanOrEqual(2000)
    expect(dur).toBeLessThanOrEqual(2800)
  })
})

describe('Q5 pick-your-own clip (transcript snap)', () => {
  const words = [
    { word: 'Hello', s: 0, e: 0.3, i: 0 },
    { word: 'world.', s: 0.3, e: 0.7, i: 1 },
    { word: 'Next', s: 2.0, e: 2.2, i: 2 },
    { word: 'bit.', s: 2.2, e: 2.6, i: 3 },
  ]

  it('snaps selection to sentence edges and builds a title', () => {
    const out = snapTranscriptSelectionMs(100, 650, words, 0, 5000)
    expect(out.trimIn).toBeLessThanOrEqual(100)
    expect(out.trimOut).toBeGreaterThanOrEqual(700)
    expect(out.title.length).toBeGreaterThan(0)
  })
})

describe('Q5 CL-05 moment drag clamp', () => {
  it('keeps moment range within duration and min length', () => {
    const next = clampPickDrag({ startMs: 5000, endMs: 9000 }, 'end', 50_000, 60_000)
    expect(next.endMs).toBeLessThanOrEqual(60_000)
    expect(next.endMs - next.startMs).toBeGreaterThanOrEqual(3000)
  })
})

describe('Q5 free thumbnail overlay', () => {
  it('exposes overlay presets', () => {
    expect(FREE_THUMB_OVERLAY_PRESETS.map((p) => p.id)).toContain('bold_title')
  })
})
