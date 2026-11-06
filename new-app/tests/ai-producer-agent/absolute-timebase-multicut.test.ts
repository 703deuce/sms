import { describe, expect, it } from 'vitest'
import { createProject, addSegment } from '@/lib/ai-producer-agent/tools/edit'
import { normalizeEdits, orderedKeepSegments, outputDurationMs } from '@/lib/clips/edits'
import { validateDraft } from '@/lib/ai-producer-agent/validate'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'

const actual90sSelections = [
  [300675, 323795],
  [376935, 398640],
  [1123660, 1145125],
  [1146425, 1157670],
] as const

function ctx(): ToolCtx {
  return {
    sources: [{ sourceId: 'recording', rangeMs: [300040, 1500040] }],
    config: { editMode: 'just_chatting_rough_cut', targetLengthS: [75, 105], memeSfx: 'off' },
    cache: { words: [] },
    usedPayoffs: [],
  } as unknown as ToolCtx
}
function build(cuts: ReadonlyArray<readonly [number, number]>) {
  const c = ctx()
  const out = { index: 0, outputType: 'story', builder: null, notes: [] } as unknown as OutputState
  expect(createProject(c, out, { title: 'Interview', sources: ['recording'] }).ok).toBe(true)
  out.builder!.preserveApprovedEdges = true
  for (const [srcInMs, srcOutMs] of cuts) {
    expect(addSegment(c, out, { sourceId: 'recording', srcInMs, srcOutMs }).ok).toBe(true)
  }
  return { c, out }
}

describe('AI Producer source-absolute EDL from 90s run diagnostics', () => {
  it('preserves four curated intervals and three real joins without adding the last-20min offset', () => {
    const { c, out } = build(actual90sSelections)
    const edits = out.builder!.snapshot()
    expect(edits.trim).toEqual({ in: 300675, out: 1157670 })
    expect(orderedKeepSegments(edits)).toEqual(actual90sSelections.map((x) => [...x]))
    expect(edits.cutRanges).toEqual([
      [323795, 376935], [398640, 1123660], [1145125, 1146425],
    ])
    expect(outputDurationMs(edits)).toBe(77535)
    const report = validateDraft(out.builder!, {
      words: [], laughs: [], reactions: [], bursts: [],
      layoutAt: () => null, outputType: 'story',
      editMode: 'just_chatting_rough_cut', sourceRangeMs: c.sources[0]!.rangeMs,
      audioEvidenceAvailable: false, targetLengthS: [75, 105],
      memeSfx: 'off', payoffSrc: [],
    })
    expect(report.hardFailures).toEqual([])
    expect(report.warnings.map((w) => w.code)).not.toContain('length_out_of_target')
    // Persistence re-normalizes against the newly created physical clip bounds.
    const persisted = normalizeEdits(edits, {
      clipStartMs: 298675, clipEndMs: 1159670,
      trimMinMs: 0, trimMaxMs: 1159670,
    })
    expect(persisted.trim).toEqual(edits.trim)
    expect(orderedKeepSegments(persisted)).toEqual(orderedKeepSegments(edits))
    expect(outputDurationMs(persisted)).toBe(77535)
  })

  it('does not shift the surviving 20-second passage by +300040ms', () => {
    const { out } = build([[1123660, 1143925]])
    const edits = out.builder!.snapshot()
    expect(edits.trim).toEqual({ in: 1123660, out: 1143925 })
    expect(edits.cutRanges).toEqual([])
    expect(outputDurationMs(edits)).toBe(20265)
    const persisted = normalizeEdits(edits, {
      clipStartMs: 1121660, clipEndMs: 1145925,
      trimMinMs: 0, trimMaxMs: 1145925,
    })
    expect(persisted.trim).toEqual(edits.trim)
    expect(outputDurationMs(persisted)).toBe(20265)
  })
})
