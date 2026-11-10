import { describe, expect, it } from 'vitest'
import { defaultEdits, displayDurationMs, type ClipBounds, type ClipEditsV2 } from '@/lib/clips/edits'
import {
  CLEAN_TAKE_COPY,
  CLEAN_TAKE_DEFAULT_STRENGTH,
  CLEAN_TAKE_EXPORT_ON_FINISH_DEFAULT,
  buildCleanTakeRunBody,
  introOutroLockedRanges,
  invertRangesWithin,
  lightStrengthExcludesOptInFillers,
  omittedRangesFromCleanTakeCuts,
  omitRestoredOmissions,
  overlapsAnyLockedRange,
  parseCleanTakeMeta,
  playRemovedOnlyCues,
  playRemovedOnlyEdits,
  playRemovedOnlyFromOmissions,
  restoreCleanTakeOmission,
  type CleanTakeKeptCut,
  type CleanTakeOmission,
} from '@/lib/clips/editor/clean-take-review'
import { fillerProposals } from '@/lib/clips/editor/cleanup-proposals'
import { restoreCleanupProposal } from '@/lib/clips/editor/cleanup-proposals'
import { DEFAULT_CLEANUP_STRENGTH, OPT_IN_FILLER_WORDS, fillerEligibleAtStrength } from '@/lib/clips/editor/cleanup-strength'
import type { EditorWord } from '@/lib/clips/script-editor/to-editor-words'

const bounds: ClipBounds = {
  clipStartMs: 0,
  clipEndMs: 60_000,
  trimMinMs: 0,
  trimMaxMs: 60_000,
}

function baseEdits(overrides: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return {
    ...defaultEdits(bounds),
    trim: { in: 10_000, out: 20_000 },
    cutRanges: [],
    sources: [
      {
        id: 'multi_0',
        ref: 'upload',
        refId: 'upl_main',
        mediaType: 'video',
        label: 'take-a',
        durationMs: 60_000,
      },
    ],
    ...overrides,
  }
}

describe('Clean Take suggestion-first defaults', () => {
  it('sends exportOnFinish false and never requests an automatic render', () => {
    expect(CLEAN_TAKE_EXPORT_ON_FINISH_DEFAULT).toBe(false)
    const body = buildCleanTakeRunBody({
      sources: [{ projectId: 'proj_1', title: 'Talk' }],
      instruction: '  keep the joke  ',
    })
    expect(body.exportOnFinish).toBe(false)
    expect(body.storyMode).toBe('clean_take_v1')
    expect(body.instruction).toBe('keep the joke')
    expect(body.sources).toEqual([
      { sourceId: 'source_0', kind: 'upload', projectId: 'proj_1', title: 'Talk' },
    ])
    expect(body.lockedRanges).toBeUndefined()
  })

  it('includes lockedRanges on the run body when the user set locks', () => {
    const body = buildCleanTakeRunBody({
      sources: [{ projectId: 'proj_1', title: 'Talk' }],
      lockedRanges: [
        { id: 'lock-intro', label: 'Intro', startMs: 0, endMs: 3000, sourceId: 'proj_1' },
        { id: 'lock-empty', label: 'Empty', startMs: 10, endMs: 10 },
      ],
    })
    expect(body.exportOnFinish).toBe(false)
    expect(body.lockedRanges).toEqual([
      { id: 'lock-intro', label: 'Intro', startMs: 0, endMs: 3000, sourceId: 'proj_1' },
    ])
  })

  it('does not describe an unsupervised finished video', () => {
    const blob = Object.values(CLEAN_TAKE_COPY).join(' ').toLowerCase()
    expect(blob).toContain('review')
    expect(blob).not.toContain('finished video')
    expect(blob).not.toContain('automatic cleanup')
    expect(blob).not.toContain('$')
  })

  it('defaults filler strength to light and excludes opt-in words and hmm/repeats', () => {
    expect(CLEAN_TAKE_DEFAULT_STRENGTH).toBe('light')
    expect(DEFAULT_CLEANUP_STRENGTH).toBe('normal')
    expect(lightStrengthExcludesOptInFillers()).toBe(true)
    expect(fillerEligibleAtStrength('um', 'lexicon', CLEAN_TAKE_DEFAULT_STRENGTH, new Set())).toBe(true)
    expect(fillerEligibleAtStrength('uh', 'lexicon', CLEAN_TAKE_DEFAULT_STRENGTH, new Set())).toBe(true)
    expect(fillerEligibleAtStrength('hmm', 'lexicon', CLEAN_TAKE_DEFAULT_STRENGTH, new Set())).toBe(false)
    for (const word of OPT_IN_FILLER_WORDS) {
      expect(fillerEligibleAtStrength(word, 'lexicon', CLEAN_TAKE_DEFAULT_STRENGTH, new Set())).toBe(false)
    }
  })
})

describe('omittedRangesFromCleanTakeCuts', () => {
  it('derives leftover source spans from kept cuts plus source extents', () => {
    const cuts: CleanTakeKeptCut[] = [
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 10_000, endMs: 20_000, reason: 'keep' },
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 40_000, endMs: 50_000, reason: 'keep later' },
    ]
    const omissions = omittedRangesFromCleanTakeCuts(cuts, [
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 0, endMs: 60_000 },
    ])
    expect(omissions.map((row) => [row.startMs, row.endMs, row.type])).toEqual([
      [0, 10_000, 'omission'],
      [20_000, 40_000, 'retake'],
      [50_000, 60_000, 'omission'],
    ])
    expect(omissions[1]?.reason.toLowerCase()).toMatch(/earlier take|omitted/)
  })

  it('parses cuts from aiMeta.cleanTake payloads', () => {
    const parsed = parseCleanTakeMeta({
      aiMeta: {
        cleanTake: {
          mode: 'clean_take_v1',
          durationMs: 20_000,
          outline: { title: 'Talk' },
          cuts: [
            { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 1000, endMs: 4000, reason: 'keep' },
          ],
        },
      },
    })
    expect(parsed?.title).toBe('Talk')
    expect(parsed?.cuts).toHaveLength(1)
    expect(parsed?.cuts[0]?.startMs).toBe(1000)
  })
})

describe('restore of each omission', () => {
  it('re-inserts a leading same-source omission by expanding trim and restores picture/sound', () => {
    const edits = baseEdits()
    const before = displayDurationMs(edits)
    const omission: CleanTakeOmission = {
      id: 'source_0:0:8000',
      sourceId: 'source_0',
      sourceProjectId: 'proj_1',
      startMs: 0,
      endMs: 8000,
      type: 'omission',
      reason: 'Opening material omitted from the first pass',
    }
    const result = restoreCleanTakeOmission(edits, omission, [
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 10_000, endMs: 20_000 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.trim.in).toBe(0)
    expect(result.edits.trim.out).toBe(20_000)
    expect(result.edits.cutRanges).toEqual([[8000, 10_000]])
    expect(displayDurationMs(result.edits)).toBe(before + 8000)
  })

  it('re-inserts a later same-source omission by expanding trim and increases duration', () => {
    const edits = baseEdits()
    const before = displayDurationMs(edits)
    const omission: CleanTakeOmission = {
      id: 'source_0:30000:38000',
      sourceId: 'source_0',
      sourceProjectId: 'proj_1',
      startMs: 30_000,
      endMs: 38_000,
      type: 'retake',
      reason: 'Earlier take omitted',
    }
    const result = restoreCleanTakeOmission(edits, omission, [
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 10_000, endMs: 20_000 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // No later inserts: expand the main trim and cut the hole so picture/sound return.
    expect(result.edits.trim).toEqual({ in: 10_000, out: 38_000 })
    expect(result.edits.cutRanges).toEqual([[20_000, 30_000]])
    expect(displayDurationMs(result.edits)).toBe(before + 8000)
  })

  it('appends a later omission as an insert when later inserts already exist', () => {
    const edits = baseEdits({
      inserts: [
        {
          id: 'existing_tail',
          sourceId: 'multi_0',
          atSrcMs: 20_000,
          append: true,
          inMs: 50_000,
          durMs: 2000,
          audio: 'source',
          fit: 'contain',
        },
      ],
    })
    const before = displayDurationMs(edits)
    const omission: CleanTakeOmission = {
      id: 'source_0:30000:38000',
      sourceId: 'source_0',
      sourceProjectId: 'proj_1',
      startMs: 30_000,
      endMs: 38_000,
      type: 'retake',
      reason: 'Earlier take omitted',
    }
    const result = restoreCleanTakeOmission(edits, omission, [
      { sourceId: 'source_0', sourceProjectId: 'proj_1', startMs: 10_000, endMs: 20_000 },
    ])
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.edits.inserts?.some((row) => row.inMs === 30_000 && row.durMs === 8000 && row.audio === 'source')).toBe(true)
    expect(displayDurationMs(result.edits)).toBe(before + 8000)
    expect(result.edits.trim).toEqual({ in: 10_000, out: 20_000 })
  })

  it('uses restoreCleanupProposal for an omission already represented as a cut range', () => {
    const edits = baseEdits({
      trim: { in: 0, out: 20_000 },
      cutRanges: [[4000, 8000]],
    })
    const restored = restoreCleanupProposal(edits, [4000, 8000])
    expect(restored.cutRanges).toEqual([])
    expect(displayDurationMs(restored)).toBe(20_000)
  })

  it('leaves the kept edit unchanged when source media is missing', () => {
    const edits = baseEdits({
      sources: [
        {
          id: 'multi_0',
          ref: 'upload',
          refId: 'upl_main',
          mediaType: 'video',
          label: 'take-a',
          durationMs: 60_000,
        },
        {
          id: 'multi_1',
          ref: 'upload',
          refId: 'upl_other',
          mediaType: 'video',
          label: 'take-b',
          durationMs: 40_000,
        },
      ],
      inserts: [
        {
          id: 'kept_other',
          sourceId: 'multi_1',
          atSrcMs: 20_000,
          append: true,
          inMs: 0,
          durMs: 2000,
          audio: 'source',
          fit: 'contain',
        },
      ],
    })
    const omission: CleanTakeOmission = {
      id: 'source_absent:30000:38000',
      sourceId: 'source_absent',
      sourceProjectId: 'proj_missing',
      startMs: 30_000,
      endMs: 38_000,
      type: 'omission',
      reason: 'Unknown source',
    }
    const result = restoreCleanTakeOmission(edits, omission, [
      { sourceId: 'source_0', startMs: 10_000, endMs: 20_000 },
    ])
    expect(result.ok).toBe(false)
    expect(result.edits).toBe(edits)
    expect(result.edits.trim).toEqual({ in: 10_000, out: 20_000 })
  })

  it('drops a restored omission from the remaining review list', () => {
    const omissions: CleanTakeOmission[] = [
      {
        id: 'source_0:0:10000',
        sourceId: 'source_0',
        startMs: 0,
        endMs: 10_000,
        type: 'omission',
        reason: 'Opening material omitted from the first pass',
      },
      {
        id: 'source_0:20000:30000',
        sourceId: 'source_0',
        startMs: 20_000,
        endMs: 30_000,
        type: 'retake',
        reason: 'Earlier take or mid-passage omitted from the first pass',
      },
    ]
    const remaining = omitRestoredOmissions(omissions, ['source_0:0:10000'])
    expect(remaining).toHaveLength(1)
    expect(remaining[0]?.id).toBe('source_0:20000:30000')
  })
})

describe('play removed only', () => {
  it('builds an edit of only the removed ranges on a cut list', () => {
    const edits = baseEdits({
      trim: { in: 0, out: 10_000 },
      cutRanges: [[1000, 2000], [5000, 7000]],
    })
    const preview = playRemovedOnlyEdits(edits, [
      [1000, 2000],
      [5000, 7000],
    ])
    expect(invertRangesWithin([0, 10_000], [[1000, 2000], [5000, 7000]])).toEqual([
      [0, 1000],
      [2000, 5000],
      [7000, 10_000],
    ])
    expect(preview.cutRanges).toEqual([
      [0, 1000],
      [2000, 5000],
      [7000, 10_000],
    ])
    expect(displayDurationMs(preview)).toBe(1000 + 2000)
  })

  it('builds a Clean Take preview that plays only omitted takes', () => {
    const edits = baseEdits()
    const omissions: CleanTakeOmission[] = [
      {
        id: 'source_0:30000:34000',
        sourceId: 'source_0',
        startMs: 30_000,
        endMs: 34_000,
        type: 'retake',
        reason: 'Dropped take',
      },
    ]
    const preview = playRemovedOnlyFromOmissions(edits, omissions, [
      { sourceId: 'source_0', startMs: 10_000, endMs: 20_000 },
    ])
    expect(preview.inserts).toHaveLength(1)
    expect(preview.inserts?.[0]?.durMs).toBe(4000)
    // Main kept take is fully cut so only removals play
    expect(preview.cutRanges).toEqual([[10_000, 20_000]])
    expect(displayDurationMs(preview)).toBe(4000)
  })

  it('builds a cue list for every remaining omitted range', () => {
    const cues = playRemovedOnlyCues([
      { id: 'a', sourceId: 'source_0', startMs: 0, endMs: 1500, type: 'omission', reason: 'lead' },
      { id: 'b', sourceId: 'source_0', startMs: 30_000, endMs: 34_000, type: 'retake', reason: 'take' },
      { id: 'tiny', sourceId: 'source_0', startMs: 40_000, endMs: 40_100, type: 'silence', reason: 'short' },
    ])
    expect(cues).toEqual([
      { id: 'a', startSec: 0, endSec: 1.5 },
      { id: 'b', startSec: 30, endSec: 34 },
    ])
  })
})

describe('locked ranges', () => {
  it('marks intro and outro locks and reports overlaps', () => {
    const locks = introOutroLockedRanges(0, 60_000, 3000, 5000)
    expect(locks).toEqual([
      { id: 'lock-intro', label: 'Intro', startMs: 0, endMs: 3000, sourceId: undefined },
      { id: 'lock-outro', label: 'Outro', startMs: 55_000, endMs: 60_000, sourceId: undefined },
    ])
    expect(overlapsAnyLockedRange([1000, 2000], locks)).toBe(true)
    expect(overlapsAnyLockedRange([20_000, 21_000], locks)).toBe(false)
  })

  it('excludes locked ranges from fillerProposals', () => {
    const words: EditorWord[] = [
      { id: 'w0', text: 'um', t0Ms: 500, t1Ms: 800, isFiller: true, fillerKind: 'lexicon' } as EditorWord,
      { id: 'w1', text: 'hello', t0Ms: 2000, t1Ms: 2400, isFiller: false } as EditorWord,
      { id: 'w2', text: 'uh', t0Ms: 8000, t1Ms: 8300, isFiller: true, fillerKind: 'lexicon' } as EditorWord,
    ]
    const all = fillerProposals(words, new Set(), { strength: 'light' })
    expect(all.map((row) => row.range[0])).toEqual([500, 8000])
    const locked = fillerProposals(words, new Set(), {
      strength: 'light',
      lockedRanges: [[0, 3000]],
    })
    expect(locked).toHaveLength(1)
    expect(locked[0]?.range).toEqual([8000, 8300])
  })
})
