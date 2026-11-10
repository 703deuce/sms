import { describe, expect, it, vi } from 'vitest'
import { ytAdvanceLongForm, ytAllWindows } from '@/lib/youtube-video/pipeline/yt-orchestrator'
import type { YtCheckpoint, YtFinishedWindow, YtPlanArgs } from '@/lib/youtube-video/pipeline/yt-types'

vi.mock('@/lib/youtube-video/pipeline/yt-audit', () => ({
  ytLog: vi.fn(),
  ytErrorCode: (error: unknown) => error instanceof Error ? error.message : 'unknown',
}))

const DURATION_58_35_MS = 58 * 60_000 + 35_000

function finished(
  startMs: number,
  endMs: number,
  cutStartMs: number,
  cutEndMs: number,
  beat: string,
): YtFinishedWindow {
  return {
    sourceIndex: 0,
    startMs,
    endMs,
    outline: {
      title: beat,
      premise: 'Grounded episode premise',
      opening: 'Grounded opening',
      development: 'Grounded development',
      ending: 'Grounded ending',
      exclusions: [],
    },
    cuts: [{
      sourceId: 'src_58',
      startMs: cutStartMs,
      endMs: cutEndMs,
      beat,
      label: beat,
      reason: 'Relevant grounded source material',
      kind: 'speech',
      groundedEvidence: beat,
    }],
    rejected: [],
    coarseCount: 1,
    focusedCount: 1,
  }
}

function args(checkpoint: YtCheckpoint | null): YtPlanArgs {
  return {
    runId: 'yvrun_synthetic_58_35',
    workspaceId: 'ws_1',
    createdById: null,
    instruction: null,
    sources: [{
      sourceId: 'src_58',
      projectId: 'proj_58',
      durationMs: DURATION_58_35_MS,
      words: [
        { w: 'Opening context', s: 1, e: 5 },
        { w: 'Middle development', s: 1201, e: 1205 },
        { w: 'Recorded ending', s: 3510, e: 3515 },
      ],
    }],
    checkpoint,
    save: async () => {},
  }
}

describe('YouTube whole-source coverage checkpoint', () => {
  it('enumerates the complete 58:35 source as exactly three windows with the exact tail millisecond', () => {
    const windows = ytAllWindows(args(null))
    expect(windows).toEqual([
      { sourceIndex: 0, startMs: 0, endMs: 1_200_000 },
      { sourceIndex: 0, startMs: 1_200_000, endMs: 2_400_000 },
      { sourceIndex: 0, startMs: 2_400_000, endMs: DURATION_58_35_MS },
    ])
  })

  it('finishes a synthetic 58:35 checkpoint with cuts and real chapters from all three windows', async () => {
    const checkpoint: YtCheckpoint = {
      version: 1,
      sourcesKey: `src_58:proj_58:${DURATION_58_35_MS}:3`,
      active: null,
      finished: [
        finished(0, 1_200_000, 1_000, 5_000, 'Why the recording begins here'),
        finished(1_200_000, 2_400_000, 1_201_000, 1_205_000, 'What changes in the middle'),
        finished(2_400_000, DURATION_58_35_MS, 3_510_000, DURATION_58_35_MS, 'How the recorded ending resolves'),
      ],
      steps: [],
      final: {
        title: 'The complete recorded story',
        premise: 'A grounded story assembled without a duration target',
        selectedIndices: [0, 1, 2],
        chapterTitles: [
          'The recording begins',
          'The middle changes',
          'The recorded ending',
        ],
        qaPassed: true,
      },
    }
    const result = await ytAdvanceLongForm(args(checkpoint))
    expect(result.done).toBe(true)
    if (!result.done) throw new Error('expected completed long-form checkpoint')
    expect(result.checkpoint.finished).toHaveLength(3)
    expect(result.options).toHaveLength(1)
    expect(result.options[0]?.beats).toHaveLength(3)
    expect(result.options[0]?.beats.map(beat => beat.label)).toEqual([
      'The recording begins',
      'The middle changes',
      'The recorded ending',
    ])
    expect(result.options[0]?.beats[2]?.endMs).toBe(DURATION_58_35_MS)
    expect(result.options[0]?.estDurationMs).toBe(13_000)
  })

  it('enumerates more than 51 analysis windows without dropping a 100ms source tail', () => {
    const durationMs = 52 * 20 * 60_000 + 100
    const longArgs: YtPlanArgs = {
      ...args(null),
      sources: [{
        sourceId: 'src_52_windows',
        projectId: 'proj_52_windows',
        durationMs,
        words: [],
      }],
    }
    const windows = ytAllWindows(longArgs)
    expect(windows).toHaveLength(52)
    expect(windows[51]?.endMs).toBe(durationMs)
  })
})
