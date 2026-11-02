import { describe, expect, it, vi } from 'vitest'
import { defaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { isPendingStockAssetId, pendingStockProviderId } from '@/lib/clips/broll-auto-utils'
import {
  applySplitScreenOnOverlap,
  overlappingSpeakerRangesFromWords,
  subtractRangeFromLayoutSegments,
} from '@/lib/clips/editor/reframe-overlap'
import { autoMapSpeakersToAngles, buildMulticamSegments, fillActiveSpeakerGaps } from '@/lib/clips/editor/sources'
import { layoutModeAtSourceMs, normalizeLayoutSegments } from '@/lib/clips/layout-segments'
import { __testAutoBroll } from '@/lib/server/clips/broll-auto-llm'
import type { CropShot } from '@/lib/server/clips/clip-detail'
import type { SourceWord } from '@/lib/clips/source-words'
import type { ClipWord } from '@/lib/clips/edits'

const bounds = { clipStartMs: 0, clipEndMs: 60_000 }

describe('Q6-fix2 batch', () => {
  it('B-roll LLM filter: seconds atMs, query fallback, stem match', () => {
    const words: ClipWord[] = [
      { w: 'reading', s: 5, e: 6, i: 0 },
      { w: 'comics', s: 6, e: 7, i: 1 },
    ]
    const { placements, dropReasons } = __testAutoBroll.filterPlacements({
      words,
      outputDurationMs: 30_000,
      raw: [
        { atMs: 5, durationMs: 2500, query: 'comic books stack', must_include: [] },
        { atMs: 500, durationMs: 2500, query: 'office desk', must_include: ['desks'] },
      ],
    })
    expect(placements[0]?.atMs).toBe(5000)
    expect(placements[0]?.must_include.length).toBeGreaterThan(0)
    expect(dropReasons.some((d) => d.reason === 'before_hook_1500ms')).toBe(true)
    expect(__testAutoBroll.tokensMatchTranscript('comics', 'reading comics')).toBe(true)
  })

  it('pending stock ids defer DB ingest until accept', () => {
    const id = 'pending:12345'
    expect(isPendingStockAssetId(id)).toBe(true)
    expect(pendingStockProviderId(id)).toBe('12345')
  })

  it('split-screen subtracts base range so split mode wins at overlap', () => {
    const words: SourceWord[] = [
      { s: 1, e: 4, w: 'a', spk: 0, i: 0 },
      { s: 2, e: 5, w: 'b', spk: 1, i: 1 },
    ]
    const shots: CropShot[] = [
      { startMs: 0, endMs: 2000, speaker: 'A' },
      { startMs: 2000, endMs: 5000, speaker: 'B' },
    ]
    const base = normalizeEdits(
      {
        ...defaultEdits(bounds),
        layout: { mode: 'speaker_follow', layoutSegments: [{ startMs: 0, endMs: 60_000, mode: 'speaker_follow' }] },
      } as ClipEditsV2,
      bounds,
    )
    const on = applySplitScreenOnOverlap(base, shots, words, true)
    const ranges = overlappingSpeakerRangesFromWords(words, 0, 60_000)
    expect(ranges.ranges.length).toBeGreaterThan(0)
    const probeMs = Math.round(((ranges.ranges[0]!.startMs + ranges.ranges[0]!.endMs) / 2))
    expect(layoutModeAtSourceMs(on, probeMs)).toBe('split')
    const off = applySplitScreenOnOverlap(on, shots, words, false)
    expect(off.layout.layoutSegments?.some((s) => s.auto)).toBeFalsy()
  })

  it('subtractRangeFromLayoutSegments yields non-overlapping pieces', () => {
    const pieces = subtractRangeFromLayoutSegments(
      [{ startMs: 0, endMs: 10_000, mode: 'speaker_follow' }],
      2000,
      5000,
    )
    expect(pieces).toEqual([
      { startMs: 0, endMs: 2000, mode: 'speaker_follow' },
      { startMs: 5000, endMs: 10_000, mode: 'speaker_follow' },
    ])
  })

  it('normalizeLayoutSegments preserves auto flag for toggle-off', () => {
    const segs = normalizeLayoutSegments(
      [{ startMs: 2000, endMs: 5000, mode: 'split', auto: true }],
      0,
      60_000,
      'speaker_follow',
    )
    expect(segs.some((s) => s.auto === true && s.mode === 'split')).toBe(true)
  })

  it('multicam auto-maps speakers round-robin before generating cuts', () => {
    const camA = { id: 'u1', ref: 'upload' as const, refId: 'u1', mediaType: 'video' as const, label: 'A', syncMs: 0 }
    const camB = { id: 'u2', ref: 'upload' as const, refId: 'u2', mediaType: 'video' as const, label: 'B', syncMs: 0 }
    let e = normalizeEdits({ ...defaultEdits(bounds), sources: [camA, camB] } as ClipEditsV2, bounds)
    e = autoMapSpeakersToAngles(e, ['0', '1'], ['u1', 'u2'])
    expect(e.multicam?.speakerSources?.['0']).toBe('u1')
    expect(e.multicam?.speakerSources?.['1']).toBe('u2')
    const words = [
      { s: 0, e: 3, spk: 0, i: 0 },
      { s: 3, e: 6, spk: 1, i: 1 },
      { s: 6, e: 10, spk: 0, i: 2 },
    ]
    const generated = buildMulticamSegments(words, 0, 20_000, e.multicam, e.sources, [])
    expect(generated.some((g) => g.auto && g.sourceId === 'u2')).toBe(true)
    const { generated: filled } = fillActiveSpeakerGaps(e, words, 0, 20_000, [])
    expect(filled.length).toBeGreaterThan(0)
  })

  it('generations GET signs with createReadableSignedUrl (legacy Supabase keys)', async () => {
    const fs = await import('node:fs')
    const src = fs.readFileSync(new URL('../app/api/clips/generations/[id]/route.ts', import.meta.url), 'utf8')
    expect(src).toMatch(/createReadableSignedUrl\(fresh\.storageKey/)
    expect(src).not.toMatch(/storage\.createSignedDownloadUrl\(fresh\.storageKey/)
  })

  it('buildAutoBrollItems surfaces providerError when Pixabay is not configured', async () => {
    vi.stubEnv('PIXABAY_API_KEY', '')
    const { buildAutoBrollItems } = await import('@/lib/server/clips/broll-auto')
    vi.spyOn(await import('@/lib/server/clips/broll-auto-llm'), 'suggestAutoBrollPlacements').mockResolvedValue({
      placements: [{ atMs: 5000, durationMs: 2500, query: 'coffee cup', must_include: ['coffee'] }],
      rawCount: 1,
      dropReasons: [],
    })
    const edits = normalizeEdits(defaultEdits(bounds), bounds)
    const words: ClipWord[] = [{ w: 'coffee', s: 5, e: 6, i: 0 }]
    const res = await buildAutoBrollItems(edits, words, { clipTitle: 't', deferStockCache: true })
    expect(res.providerError).toMatch(/not configured/i)
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })
})
