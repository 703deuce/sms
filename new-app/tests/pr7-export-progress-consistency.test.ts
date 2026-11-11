import { describe, expect, it } from 'vitest'
import { alignStepPctWithOverall, exportProgressFromSteps, formatExportProgressLineMonotonic } from '@/lib/clips/export-progress-steps'
import { formatExportProgressLine, monotonicPct } from '@/lib/clips/editor/export-progress-text'

describe('PR7 XE03 — truthful render progress', () => {
  it('never presents an incompatible stage percent as if it matched overall', () => {
    expect(alignStepPctWithOverall(6, 74, 3, 1)).toBeNull()
    expect(formatExportProgressLine({ status: 'RENDERING', progress: 6, phase: 'encode', etaSec: null, detail: { step: 1, steps: 3, stepPct: 74 } }))
      .toBe('Rendering export… 6% · step 1 of ~3')
    expect(formatExportProgressLineMonotonic({ status: 'RENDERING', progress: 6, phase: 'encode', etaSec: null, detail: { step: 1, steps: 3, stepPct: 74 } }))
      .toBe('Rendering export… 6% · step 1 of ~3')
    expect(alignStepPctWithOverall(25, 75, 3, 1)).toBe(75)
    expect(exportProgressFromSteps(0, .75, 3)).toBe(25)
  })
  it('does not report invalid ordinals or percentages and guards reconnect ordering', () => {
    expect(alignStepPctWithOverall(10, Number.NaN, 3, 1)).toBeNull()
    expect(alignStepPctWithOverall(10, 80, 0, 2)).toBeNull()
    expect(formatExportProgressLine({ status: 'RENDERING', progress: 10, phase: 'encode', etaSec: null, detail: { step: 9, steps: 3, stepPct: 10 } }))
      .toBe('Rendering export… 10% (encode)')
    let progress: number | null = null
    for (const pct of [6, 10, 90, 82, 100]) progress = monotonicPct(progress, pct)
    expect(progress).toBe(100)
    expect(formatExportProgressLine({ status: 'QUEUED', progress: null, phase: null, etaSec: null })).toBe('Queued for rendering…')
  })
})
