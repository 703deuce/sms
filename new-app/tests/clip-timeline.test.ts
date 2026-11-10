import { describe, expect, it } from 'vitest'
import { buildKieCreateRequest, getStudioRegistryDocument, resolveStudioCreateInput, STUDIO_MODELS } from '../lib/studio/models'
import { createStudioAsset, createStudioJob, getStudioJob, listStudioJobs, type StudioService } from '../lib/studio/jobs'
import { sendStudioJobToTimeline } from '../lib/studio/send-to-timeline'
import { createMemoryStudioStore } from '../lib/studio/store'
import type { StudioKieClient } from '../lib/studio/kie-client'
import { StudioError } from '../lib/studio/errors'
import type { KieCreateRequest, KieTaskSnapshot } from '../lib/studio/types'
import {
  applyTimelineLaneState,
  brollMediaForItems,
  buildTimelineItems,
  deleteItems,
  moveItems,
  musicWindow,
  outputToSource,
  rippleAnchoredItems,
  setLaneState,
  snapMoveDelta,
  snapTargets,
  snapValue,
  sourceToOutput,
  sourceToOutputSnapped,
  splitAt,
  timebaseFor,
  trimItem,
  type OpCtx,
} from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, editsPayloadForSave, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { moveVideoSegment, moveVideoSegmentWithGap, shiftVideoSegmentWithinSlot } from '@/lib/clips/editor/timeline-edit-ops'
import { exportTimeMap, toExportMs } from '@/lib/clips/editor/export-time'

const bounds = { clipStartMs: 0, clipEndMs: 10000, trimMinMs: 0, trimMaxMs: 20000 }

function base(patch: Partial<ClipEditsV2> = {}): ClipEditsV2 {
  return { ...normalizeEdits(defaultEdits(bounds), bounds), loopFriendlyEnd: false, ...patch }
}

const ctxOf = (edits: ClipEditsV2): OpCtx => ({ edits, previewEdits: edits })

describe('time base (output ms of the effective EDL)', () => {
  const e = base({ cutRanges: [[3000, 4000]] })
  const tb = timebaseFor(e)
  it('maps output ↔ source across a cut', () => {
    expect(tb.durationMs).toBe(9000)
    expect(outputToSource(tb, 2500)).toBe(2500)
    expect(outputToSource(tb, 3000)).toBe(4000)
    expect(sourceToOutput(tb, 5000)).toBe(4000)
    expect(sourceToOutput(tb, 3500)).toBeNull()
    expect(sourceToOutputSnapped(tb, 3500)).toBe(3000)
  })
  it('follows section order', () => {
    const r = base({ trim: { in: 0, out: 9000 }, sectionOrder: [[6000, 9000], [0, 6000]] })
    const t = timebaseFor(r)
    expect(t.segs[0]).toEqual([6000, 9000])
    expect(outputToSource(t, 0)).toBe(6000)
    expect(sourceToOutput(t, 0)).toBe(3000)
  })
})

describe('lanes', () => {
  it('builds video segments, B-roll, music window, SFX and hook items on one time base', () => {
    const e = base({
      cutRanges: [[3000, 4000]],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 4000, endMs: 6000 }],
      audio: { music: { generationId: 'm', startMs: 1000 }, sfx: [{ generationId: 's', atMs: 3000 }] },
      hookOverlay: { enabled: true, text: 'Hi', durationMs: 2500 },
    })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e, sfxDurationsMs: { s: 700 } })
    expect(lanes.video.map((v) => [v.startMs, v.endMs])).toEqual([
      [0, 3000],
      [3000, 9000],
    ])
    expect(lanes.voice).toHaveLength(2)
    // B-roll bars are OUTPUT ms (the old timeline drew them on the source span → offset after cuts)
    expect(lanes.broll[0]).toMatchObject({ startMs: 4000, endMs: 6000 })
    expect(lanes.music[0]).toMatchObject({ startMs: 1000, endMs: 9000, inMs: 0 })
    expect(lanes.sfx[0]).toMatchObject({ startMs: 3000, endMs: 3700 })
    expect(lanes.text[0]).toMatchObject({ startMs: 0, endMs: 2500, label: 'Hi' })
  })
  it('music window clamps to the clip', () => {
    expect(musicWindow({ generationId: 'm', startMs: 9900, endMs: 99999 }, 8000)).toEqual({
      startMs: 7500,
      endMs: 8000,
      inMs: 0,
    })
  })
  it('extends music end to clip tail when within fadeOut (AU-33)', () => {
    expect(musicWindow({ generationId: 'm', startMs: 0, endMs: 38700, fadeOutMs: 3000 }, 41000)).toEqual({
      startMs: 0,
      endMs: 41000,
      inMs: 0,
    })
  })
})

describe('operations map onto the edits model', () => {
  const withBroll = base({
    broll: [
      { id: 'b1', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000 },
      { id: 'b2', source: 'ai', generationId: 'g', startMs: 5000, endMs: 7000 },
    ],
    audio: { music: { generationId: 'm' }, sfx: [{ generationId: 's', atMs: 2000 }] },
  })

  it('moves a multi-selection by one shared, clamped delta', () => {
    const next = moveItems(
      ctxOf(withBroll),
      [
        { lane: 'broll', id: 'b1' },
        { lane: 'sfx', id: 's' },
      ],
      -1500,
    )!
    // b1 can only move -1000 (start hits 0) → the whole selection moves -1000
    expect(next.broll![0]).toMatchObject({ startMs: 0, endMs: 2000 })
    expect(next.audio!.sfx[0]!.atMs).toBe(1000)
    expect(next.broll![1]).toMatchObject({ startMs: 5000 })
  })

  it('left-trim keeps B-roll content anchored via inMs', () => {
    const next = trimItem(ctxOf(withBroll), { lane: 'broll', id: 'b1' }, 'start', 1600)!
    expect(next.broll![0]).toMatchObject({ startMs: 1600, endMs: 3000, inMs: 600 })
    // cannot reveal media before 0
    const back = trimItem(ctxOf(next), { lane: 'broll', id: 'b1' }, 'start', 0)!
    expect(back.broll![0]).toMatchObject({ startMs: 1000, inMs: 0 })
  })

  it('trims and moves the music bed window', () => {
    const t = trimItem(ctxOf(withBroll), { lane: 'music', id: 'm' }, 'start', 2000)!
    expect(t.audio!.music).toMatchObject({ startMs: 2000, inMs: 2000 })
    const e = trimItem(ctxOf(t), { lane: 'music', id: 'm' }, 'end', 6000)!
    expect(e.audio!.music).toMatchObject({ startMs: 2000, endMs: 6000 })
    const m = moveItems(ctxOf(e), [{ lane: 'music', id: 'm' }], 1000)!
    expect(m.audio!.music).toMatchObject({ startMs: 3000, endMs: 7000, inMs: 2000 })
  })

  it('splits B-roll at the playhead into two items with continuous media', () => {
    const next = splitAt(ctxOf(withBroll), [{ lane: 'broll', id: 'b2' }], 6000)!
    const parts = next.broll!.filter((b) => b.id.startsWith('b2'))
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatchObject({ id: 'b2', startMs: 5000, endMs: 6000 })
    expect(parts[1]).toMatchObject({ startMs: 6000, endMs: 7000, inMs: 1000 })
    expect(parts[1]!.id).toBe('b2~6000')
  })

  it('split without a selection splits the main video (layout boundary)', () => {
    const next = splitAt(ctxOf(withBroll), [], 4000)!
    expect(next.layout.layoutSegments?.length).toBeGreaterThanOrEqual(2)
    expect(next.layout.layoutSegments!.some((s) => s.startMs === 4000 || s.endMs === 4000)).toBe(true)
  })

  it('splits linked main video when only a Voice item is selected (B3)', () => {
    const e = base()
    const voice = buildTimelineItems({ edits: e, previewEdits: e }).voice[0]!
    const next = splitAt(ctxOf(e), [{ lane: 'voice', id: voice.id }], 4000)!
    expect(next.videoSplits).toContain(4000)
    const lanes = buildTimelineItems({ edits: next, previewEdits: next })
    expect(lanes.video).toHaveLength(2)
    expect(lanes.voice).toHaveLength(2)
  })

  it('does not split a locked Voice selection (B3)', () => {
    const e = setLaneState(base(), 'voice', { locked: true })
    const voice = buildTimelineItems({ edits: e, previewEdits: e }).voice[0]!
    expect(splitAt(ctxOf(e), [{ lane: 'voice', id: voice.id }], 4000)).toBeNull()
  })

  it('deletes items; a video segment becomes a cut range; the last segment is kept', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    const next = deleteItems(ctxOf(e), [{ lane: 'video', id: 'seg:0' }])!
    expect(next.cutRanges).toEqual([[0, 4000]])
    const both = deleteItems(ctxOf(e), [
      { lane: 'video', id: 'seg:0' },
      { lane: 'video', id: 'seg:4000' },
    ])!
    expect(timebaseFor(both).durationMs).toBeGreaterThan(0)
    const d = deleteItems(ctxOf(withBroll), [
      { lane: 'broll', id: 'b1' },
      { lane: 'music', id: 'm' },
      { lane: 'sfx', id: 's' },
    ])!
    expect(d.broll!.map((b) => b.id)).toEqual(['b2'])
    expect(d.audio!.music).toBeNull()
    expect(d.audio!.sfx).toEqual([])
  })

  it('video edge trims edit cuts and trim (never creates a new model)', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    // shrink seg 2 start by 500 → cut grows
    const s = trimItem(ctxOf(e), { lane: 'video', id: 'seg:4000' }, 'start', 3500)!
    expect(s.cutRanges).toEqual([[3000, 4500]])
    // extend seg 1 end into the cut → cut shrinks (restore)
    const r = trimItem(ctxOf(e), { lane: 'video', id: 'seg:0' }, 'end', 3400)!
    expect(r.cutRanges).toEqual([[3400, 4000]])
    // clip in-point → trim.in
    const tin = trimItem(ctxOf(e), { lane: 'video', id: 'seg:0' }, 'start', 800)!
    expect(tin.trim.in).toBe(800)
    // clip out-point → trim.out and loop-friendly trim off (WYSIWYG)
    const tout = trimItem({ ...ctxOf(e), edits: { ...e, loopFriendlyEnd: undefined } }, { lane: 'video', id: 'seg:4000' }, 'end', 8000)!
    expect(tout.trim.out).toBe(9000)
    expect(tout.loopFriendlyEnd).toBe(false)
  })

  it('magnet off: main-video start trim also inserts a gap (TIMELINE_LAYOUT1)', () => {
    const e = base({ cutRanges: [[3000, 4000]] })
    const s = trimItem({ ...ctxOf(e), magnet: false }, { lane: 'video', id: 'seg:4000' }, 'start', 3500)!
    expect(s.cutRanges).toEqual([[3000, 4500]])
    expect(s.inserts?.length).toBe(1)
    expect(s.inserts![0]!.durMs).toBe(500)
  })

  it('locked lanes are not editable', () => {
    const locked = setLaneState(withBroll, 'broll', { locked: true })
    expect(moveItems(ctxOf(locked), [{ lane: 'broll', id: 'b1' }], 500)).toBeNull()
    expect(deleteItems(ctxOf(locked), [{ lane: 'broll', id: 'b1' }])).toBeNull()
  })
})

describe('snapping', () => {
  it('snaps to playhead, cut joins, words and other item edges within the threshold', () => {
    const e = base({
      cutRanges: [[3000, 4000]],
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 6000 }],
    })
    const lanes = buildTimelineItems({ edits: e, previewEdits: e })
    const targets = snapTargets({ lanes, durationMs: 9000, playheadMs: 1234, wordEdgesMs: [2222] })
    expect(targets).toEqual(expect.arrayContaining([0, 1234, 2222, 3000, 5000, 6000, 9000]))
    expect(snapValue(1250, targets, 40)).toEqual({ ms: 1234, snappedTo: 1234 })
    expect(snapValue(1400, targets, 40).snappedTo).toBeNull()
    // moving [5000,6000] by +2980 → end edge 8980 snaps to 9000
    expect(snapMoveDelta([5000, 6000], 2980, targets.filter((t) => t !== 5000 && t !== 6000), 40)).toEqual({
      deltaMs: 3000,
      snappedTo: 9000,
    })
  })
})

describe('ripple keeps anchored items on their source content after transcript cuts', () => {
  it('B-roll and SFX after a new cut shift left by the cut length', () => {
    const prev = base({
      broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 7000 }],
      audio: { music: null, sfx: [{ generationId: 's', atMs: 6000 }] },
    })
    const next = { ...prev, cutRanges: [[1000, 2000]] as [number, number][] }
    const r = rippleAnchoredItems(prev, next, prev, next)
    expect(r.broll![0]).toMatchObject({ startMs: 4000, endMs: 6000 })
    expect(r.audio!.sfx[0]!.atMs).toBe(5000)
  })
  it('does not ripple when the anchored items themselves changed', () => {
    const prev = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 5000, endMs: 7000 }] })
    const next = { ...prev, cutRanges: [[1000, 2000]] as [number, number][], broll: [] }
    expect(rippleAnchoredItems(prev, next, prev, next)).toBe(next)
  })
  it('an item whose content was cut collapses to the join with the minimum length', () => {
    const prev = base({ broll: [{ id: 'b1', source: 'stock', assetId: 'a', startMs: 2000, endMs: 3000 }] })
    const next = { ...prev, cutRanges: [[1500, 3500]] as [number, number][] }
    const r = rippleAnchoredItems(prev, next, prev, next)
    expect(r.broll![0]).toMatchObject({ startMs: 1500, endMs: 2500 })
  })
})

describe('lane state + schema', () => {
  it('normalizeEdits keeps timelineLanes, B-roll inMs and the music window', () => {
    const raw = {
      ...base(),
      timelineLanes: { broll: { hidden: true }, video: { muted: true } },
      broll: [{ id: 'b', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000, inMs: 250 }],
      audio: { music: { generationId: 'm', startMs: 500, endMs: 4000, inMs: 100 }, sfx: [] },
    }
    const n = normalizeEdits(raw, bounds)
    expect(n.timelineLanes).toEqual({ broll: { hidden: true } })
    expect(n.broll![0]!.inMs).toBe(250)
    expect(n.audio!.music).toMatchObject({ startMs: 500, endMs: 4000, inMs: 100 })
  })
  it('video visibility persists without deleting the main source', () => {
    const e = setLaneState(base(), 'video', { hidden: true })
    expect(normalizeEdits(e, bounds).timelineLanes?.video?.hidden).toBe(true)
    expect(applyTimelineLaneState(e).timelineLanes?.video?.hidden).toBe(true)
  })
  it('clearing all lane toggles is sent as null so the server copy is cleared', () => {
    expect(editsPayloadForSave(base()).timelineLanes).toBeNull()
  })
  it('applyTimelineLaneState drops hidden/muted lanes', () => {
    const e = setLaneState(
      setLaneState(
        base({
          broll: [{ id: 'b', source: 'stock', assetId: 'a', startMs: 1000, endMs: 3000 }],
          audio: { music: { generationId: 'm' }, sfx: [{ generationId: 's', atMs: 1 }] },
        }),
        'broll',
        { hidden: true },
      ),
      'sfx',
      { muted: true },
    )
    const r = applyTimelineLaneState(e)
    expect(r.broll).toEqual([])
    expect(r.audio!.sfx).toEqual([])
    expect(r.audio!.music).not.toBeNull()
  })
  it('split B-roll items reuse the original media row for preview', () => {
    const rows = [{ id: 'b2', assetId: undefined, generationId: 'g', url: 'u' }]
    const out = brollMediaForItems(
      [
        { id: 'b2', source: 'ai', generationId: 'g', startMs: 0, endMs: 1000 },
        { id: 'b2~1000', source: 'ai', generationId: 'g', startMs: 1000, endMs: 2000, inMs: 1000 },
      ],
      rows,
    )
    expect(out.map((r) => r.id)).toEqual(['b2', 'b2~1000'])
  })
})

describe('B1 main clip reordering', () => {
  it('reorders linked video and voice with magnet on, and preserves an inserted gap with magnet off', () => {
    const edits = base({ videoSplits: [3000, 6000] })
    const on = moveVideoSegment(ctxOf(edits), 'seg:0', null)
    expect(on?.sectionOrder).toBeTruthy()
    expect(on?.inserts ?? []).toHaveLength(0)
    const off = moveVideoSegmentWithGap(ctxOf(edits), 'seg:0', null)
    expect(off?.sectionOrder).toEqual(on?.sectionOrder)
    expect(off?.inserts?.some((insert) => insert.sourceId === '__gap__' || insert.durMs === 3000)).toBe(true)
    const lanes = buildTimelineItems({ edits: off!, previewEdits: off! })
    expect(lanes.video.length).toBeGreaterThan(0)
    expect(lanes.voice.length).toBeGreaterThan(0)
  })
})

describe('B1 retest: Magnet-off sub-slot main-video movement', () => {
  it('moves a lone main-video clip forward from time zero and preserves a real opening gap', () => {
    const edits = base()
    const moved = shiftVideoSegmentWithinSlot(ctxOf(edits), 'seg:0', 1200)
    expect(moved).not.toBeNull()
    expect(moved?.inserts).toMatchObject([{ sourceId: 'gap', atSrcMs: 0, durMs: 1200 }])
    const video = buildTimelineItems({ edits: moved!, previewEdits: moved! }).video
    expect(video).toHaveLength(1)
    // Lane items remain in base time; the actual timeline draws them in export time.
    const map = exportTimeMap(timebaseFor(moved!).segs, moved!.inserts)
    expect(toExportMs(map, video[0]!.startMs, 'start')).toBe(1200)
  })

  it('moves by a short drag using a real gap and reverses it on left drag', () => {
    const e = base({ videoSplits: [5000] })
    const moved = shiftVideoSegmentWithinSlot(ctxOf(e), 'seg:5000', 950)!
    expect(moved.inserts).toMatchObject([{ sourceId: 'gap', atSrcMs: 5000, durMs: 950 }])
    const reverted = shiftVideoSegmentWithinSlot(ctxOf(moved), 'seg:5000', -950)!
    expect(reverted.inserts ?? []).toHaveLength(0)
  })

  it('does not silently invent a leftward overlap when there is no gap', () => {
    const e = base({ videoSplits: [5000] })
    expect(shiftVideoSegmentWithinSlot(ctxOf(e), 'seg:5000', -500)).toBeNull()
    expect(shiftVideoSegmentWithinSlot(ctxOf(e), 'seg:5000', 0)).toBeNull()
  })
})


function mockKie(overrides?: Partial<StudioKieClient> & {
  created?: KieCreateRequest[]
  fetches?: number
}): StudioKieClient {
  const created = overrides?.created ?? []
  return {
    async createTask(req) {
      created.push(req)
      if (overrides?.createTask) return overrides.createTask(req)
      return { taskId: 'task_mock_1' }
    },
    async fetchTask(taskId, api) {
      if (overrides?.fetches != null) overrides.fetches += 1
      if (overrides?.fetchTask) return overrides.fetchTask(taskId, api)
      return {
        state: 'success',
        resultUrl: 'https://cdn.example.test/out.mp4',
        contentTypeHint: 'video/mp4',
      } satisfies KieTaskSnapshot
    },
    async uploadImage() {
      if (overrides?.uploadImage) return overrides.uploadImage(Buffer.from('x'), 'image/png', 'ws', 'lab')
      return 'https://kie.example.test/ref.png'
    },
    async downloadUrl(url) {
      if (overrides?.downloadUrl) return overrides.downloadUrl(url)
      const isImage = /\.(png|jpe?g|webp)(?:\?|$)/i.test(url)
      return {
        bytes: Buffer.from(isImage ? 'img' : 'vid'),
        contentType: isImage ? 'image/png' : 'video/mp4',
      }
    },
  }
}

function testStorage(puts: Array<{ key: string; type: string; bytes: Buffer }> = []) {
  return {
    async putBytes(objectKey: string, body: Buffer, contentType: string) {
      puts.push({ key: objectKey, type: contentType, bytes: body })
    },
    async createSignedDownloadUrl(objectKey: string) {
      return `https://storage.example.test/${objectKey}`
    },
    driverName: () => 's3' as const,
  }
}

function makeSvc(opts?: {
  kie?: StudioKieClient
  projects?: string[]
  clips?: Array<{ projectId: string; clipId: string }>
  puts?: Array<{ key: string; type: string; bytes: Buffer }>
  concurrencyLimit?: number
}): StudioService {
  return {
    store: createMemoryStudioStore({
      projects: opts?.projects ?? ['proj_1'],
      clips: opts?.clips,
    }),
    kie: opts?.kie ?? mockKie(),
    storage: testStorage(opts?.puts),
    concurrencyLimit: opts?.concurrencyLimit ?? 3,
    now: () => new Date('2026-11-10T12:00:00.000Z'),
  }
}

describe('AI Studio v1 backend', () => {
  it('returns a config-driven registry with launch ids and no Seedance 2.5', () => {
    const doc = getStudioRegistryDocument()
    expect(doc.version).toBe(1)
    const ids = doc.models.map((m) => m.id)
    expect(ids).toEqual([
      'veo-3.1-lite',
      'veo-3.1-fast',
      'veo-3.1-quality',
      'hailuo-2.3',
      'seedance-2.0-mini',
      'flux-2-pro',
      'nano-banana',
      'nano-banana-pro',
    ])
    expect(ids).not.toContain('seedance-2.5')
    expect(doc.models.every((m) => !('providerModel' in m))).toBe(true)
    expect(JSON.stringify(doc).includes('$')).toBe(false)
  })

  it('rejects unknown models including Seedance 2.5', () => {
    expect(() =>
      resolveStudioCreateInput({ modelId: 'seedance-2.5', mode: 'text_to_video', prompt: 'a cat walks' }),
    ).toThrow(StudioError)
    try {
      resolveStudioCreateInput({ modelId: 'seedance-2.5', mode: 'text_to_video', prompt: 'a cat walks' })
    } catch (err) {
      expect((err as StudioError).code).toBe('UNKNOWN_MODEL')
    }
  })

  it('validates prompt, mode, aspect, duration, and resolution', () => {
    const cases: Array<{ body: Parameters<typeof resolveStudioCreateInput>[0]; code: string }> = [
      { body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'ab' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'seedance-2.0-mini', mode: 'text_to_image', prompt: 'a cat walks' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'veo-3.1-lite', mode: 'text_to_video', prompt: 'a cat walks', aspect: '1:1' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'seedance-2.0-mini', mode: 'text_to_video', prompt: 'a cat walks', durationSec: 1 }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'a cat walks', resolution: '8K' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'hailuo-2.3', mode: 'text_to_video', prompt: 'a cat walks' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'hailuo-2.3', mode: 'image_to_video', prompt: 'a cat walks' }, code: 'INVALID_PARAMS' },
      { body: { modelId: 'seedance-2.0-mini', mode: 'image_to_video', prompt: 'a cat walks' }, code: 'INVALID_PARAMS' },
    ]
    for (const c of cases) {
      try {
        resolveStudioCreateInput(c.body)
        throw new Error(`expected throw for ${JSON.stringify(c.body)}`)
      } catch (err) {
        expect((err as StudioError).code).toBe(c.code)
      }
    }
  })

  it('builds the cheapest Seedance and Flux request shapes', () => {
    const seedance = resolveStudioCreateInput({
      modelId: 'seedance-2.0-mini',
      mode: 'text_to_video',
      prompt: 'a red ball rolls',
    })
    expect(seedance.durationSec).toBe(4)
    expect(seedance.resolution).toBe('480p')
    const seedanceReq = buildKieCreateRequest(seedance, {})
    expect(seedanceReq).toEqual({
      api: 'jobs',
      model: 'bytedance/seedance-2-mini',
      input: {
        prompt: 'a red ball rolls',
        aspect_ratio: '16:9',
        duration: 4,
        resolution: '480p',
        generate_audio: false,
      },
    })

    const flux = resolveStudioCreateInput({
      modelId: 'flux-2-pro',
      mode: 'text_to_image',
      prompt: 'a simple red square on white',
    })
    expect(flux.resolution).toBe('1K')
    expect(buildKieCreateRequest(flux, {})).toEqual({
      api: 'jobs',
      model: 'flux-2/pro-text-to-image',
      input: { prompt: 'a simple red square on white', aspect_ratio: '1:1', resolution: '1K' },
    })
  })

  it('builds provider request shapes for every launch model', () => {
    const start = { startFrameUrl: 'https://img.example.test/start.png' }
    const shapes: Array<{
      modelId: string
      mode: 'text_to_video' | 'image_to_video' | 'text_to_image' | 'source_video_edit'
      urls?: { startFrameUrl?: string; endFrameUrl?: string; referenceUrl?: string; sourceVideoUrl?: string }
      assert: (req: KieCreateRequest) => void
    }> = [
      {
        modelId: 'veo-3.1-lite',
        mode: 'text_to_video',
        assert: (req) => {
          expect(req.api).toBe('veo')
          expect(req.model).toBe('veo3_lite')
          expect(req.input).toMatchObject({ prompt: 'a cat walks', model: 'veo3_lite', duration: 4, resolution: '720p' })
          expect(req.input.imageUrls).toBeUndefined()
        },
      },
      {
        modelId: 'veo-3.1-fast',
        mode: 'image_to_video',
        urls: { ...start, endFrameUrl: 'https://img.example.test/end.png' },
        assert: (req) => {
          expect(req.model).toBe('veo3_fast')
          expect(req.input.imageUrls).toEqual([
            'https://img.example.test/start.png',
            'https://img.example.test/end.png',
          ])
        },
      },
      {
        modelId: 'veo-3.1-quality',
        mode: 'text_to_video',
        assert: (req) => expect(req.model).toBe('veo3'),
      },
      {
        modelId: 'hailuo-2.3',
        mode: 'image_to_video',
        urls: start,
        assert: (req) => {
          expect(req).toEqual({
            api: 'jobs',
            model: 'hailuo/2-3-image-to-video-standard',
            input: {
              prompt: 'a cat walks',
              image_url: 'https://img.example.test/start.png',
              duration: '6',
              resolution: '768P',
            },
          })
        },
      },
      {
        modelId: 'seedance-2.0-mini',
        mode: 'image_to_video',
        urls: { ...start, endFrameUrl: 'https://img.example.test/end.png' },
        assert: (req) => {
          expect(req.input.first_frame_url).toBe('https://img.example.test/start.png')
          expect(req.input.last_frame_url).toBe('https://img.example.test/end.png')
          expect(req.input.reference_image_urls).toBeUndefined()
        },
      },
      {
        modelId: 'wan-2.7-video-edit',
        mode: 'source_video_edit',
        urls: { sourceVideoUrl: 'https://video.example.test/source.mp4' },
        assert: (req) => {
          expect(req.api).toBe('jobs')
          expect(req.model).toBe('wan/2-7-videoedit')
          expect(req.input).toMatchObject({
            video_url: 'https://video.example.test/source.mp4',
            duration: 2,
            resolution: '720p',
            audio_setting: 'origin',
          })
          expect(req.input.aspect_ratio).toBeUndefined()
        },
      },
      {
        modelId: 'nano-banana',
        mode: 'text_to_image',
        urls: { startFrameUrl: '', referenceUrl: 'https://img.example.test/ref.png' } as never,
        assert: (req) => {
          expect(req.model).toBe('google/nano-banana')
          expect(req.input.image_urls).toEqual(['https://img.example.test/ref.png'])
        },
      },
      {
        modelId: 'nano-banana-pro',
        mode: 'text_to_image',
        assert: (req) => {
          expect(req.model).toBe('nano-banana-pro')
          expect(req.input).toMatchObject({ resolution: '1K', output_format: 'png' })
        },
      },
    ]
    for (const row of shapes) {
      const resolved = resolveStudioCreateInput({
        modelId: row.modelId,
        mode: row.mode,
        prompt: 'a cat walks',
        startFrameAssetId: row.mode === 'image_to_video' ? 'asset_start' : undefined,
        sourceVideoAssetId: row.mode === 'source_video_edit' ? 'asset_source' : undefined,
        endFrameAssetId: row.urls?.endFrameUrl ? 'asset_end' : undefined,
        referenceAssetId: row.modelId.startsWith('nano-banana') && row.urls && 'referenceUrl' in (row.urls ?? {}) ? 'asset_ref' : undefined,
      })
      row.assert(buildKieCreateRequest(resolved, row.urls ?? {}))
    }
    expect(STUDIO_MODELS).toHaveLength(9)
  })

  it('maps hailuo 720p to 768P', () => {
    const resolved = resolveStudioCreateInput({
      modelId: 'hailuo-2.3',
      mode: 'image_to_video',
      prompt: 'a cat walks',
      startFrameAssetId: 'asset_1',
      resolution: '720p',
    })
    expect(resolved.resolution).toBe('768P')
  })

  it('creates a running job after one mocked KIE createTask and never retries on failure', async () => {
    const created: KieCreateRequest[] = []
    let calls = 0
    const kie = mockKie({
      created,
      async createTask(req) {
        calls += 1
        created.push(req)
        throw new StudioError('KIE_ERROR', 'insufficient credits')
      },
    })
    const svc = makeSvc({ kie })
    await expect(
      createStudioJob(svc, {
        workspaceId: 'ws_1',
        userId: 'user_1',
        body: { modelId: 'seedance-2.0-mini', mode: 'text_to_video', prompt: 'a red ball rolls' },
      }),
    ).rejects.toMatchObject({ code: 'KIE_ERROR', message: 'insufficient credits' })
    expect(calls).toBe(1)
    const listed = await listStudioJobs(svc, 'ws_1', {})
    expect(listed.jobs).toHaveLength(1)
    expect(listed.jobs[0].status).toBe('failed')
    expect(listed.jobs[0].error).toEqual({ code: 'KIE_ERROR', message: 'insufficient credits' })
  })

  it('polls a mocked KIE success, copies bytes into our storage, and hides provider URLs', async () => {
    const puts: Array<{ key: string; type: string; bytes: Buffer }> = []
    const kie = mockKie({
      async downloadUrl(url) {
        expect(url).toBe('https://cdn.example.test/out.png')
        return { bytes: Buffer.from('png-bytes'), contentType: 'image/png' }
      },
      async fetchTask() {
        return { state: 'success', resultUrl: 'https://cdn.example.test/out.png', contentTypeHint: 'image/png' }
      },
    })
    const svc = makeSvc({ kie, puts })
    const created = await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'a simple red square on white' },
    })
    expect(created.status).toBe('running')
    const got = await getStudioJob(svc, 'ws_1', created.id)
    expect(got.status).toBe('done')
    expect(got.output?.kind).toBe('image')
    expect(got.output?.contentType).toBe('image/png')
    expect(got.output?.previewUrl).toBe(`/api/studio/jobs/${created.id}/output`)
    expect(got.output?.downloadUrl).toBe(`/api/studio/jobs/${created.id}/output?download=1`)
    expect(JSON.stringify(got).includes('cdn.example.test')).toBe(false)
    expect(puts).toHaveLength(1)
    expect(puts[0].key).toBe(`ws/ws_1/studio/${created.id}/output.png`)
    expect(puts[0].bytes.toString()).toBe('png-bytes')
  })

  it('lists history and isolates jobs by workspace', async () => {
    const svc = makeSvc()
    const a = await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'one red square' },
    })
    await createStudioJob(svc, {
      workspaceId: 'ws_2',
      userId: 'user_1',
      body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'two red squares' },
    })
    const listed = await listStudioJobs(svc, 'ws_1', {})
    expect(listed.jobs.map((j) => j.id)).toEqual([a.id])
    await expect(getStudioJob(svc, 'ws_1', 'missing')).rejects.toMatchObject({ code: 'JOB_NOT_FOUND' })
  })

  it('enforces the per-user concurrency limit', async () => {
    const kie = mockKie({
      async fetchTask() {
        return { state: 'running' }
      },
    })
    const svc = makeSvc({ kie, concurrencyLimit: 1 })
    await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'first square' },
    })
    await expect(
      createStudioJob(svc, {
        workspaceId: 'ws_1',
        userId: 'user_1',
        body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'second square' },
      }),
    ).rejects.toMatchObject({ code: 'CONCURRENCY_LIMIT' })
    const otherUser = await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_2',
      body: { modelId: 'flux-2-pro', mode: 'text_to_image', prompt: 'other user square' },
    })
    expect(otherUser.status).toBe('running')
  })

  it('rejects send-to-timeline until the job is done, then writes into the project', async () => {
    const kie = mockKie({
      async fetchTask() {
        return { state: 'running' }
      },
    })
    const svc = makeSvc({ kie, projects: ['proj_1'], clips: [{ projectId: 'proj_1', clipId: 'clip_existing' }] })
    const created = await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: { modelId: 'seedance-2.0-mini', mode: 'text_to_video', prompt: 'a red ball rolls' },
    })
    await expect(
      sendStudioJobToTimeline(svc, { workspaceId: 'ws_1', jobId: created.id, projectId: 'proj_1' }),
    ).rejects.toMatchObject({ code: 'JOB_NOT_READY' })
    await expect(
      sendStudioJobToTimeline(svc, { workspaceId: 'ws_1', jobId: created.id, projectId: 'missing' }),
    ).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' })

    const doneSvc = makeSvc({ projects: ['proj_1'] })
    const done = await createStudioJob(doneSvc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: { modelId: 'seedance-2.0-mini', mode: 'text_to_video', prompt: 'a red ball rolls' },
    })
    await getStudioJob(doneSvc, 'ws_1', done.id)
    const sent = await sendStudioJobToTimeline(doneSvc, {
      workspaceId: 'ws_1',
      jobId: done.id,
      projectId: 'proj_1',
      write: async (input) => {
        expect(input.projectId).toBe('proj_1')
        expect(input.storageKey).toContain(`/studio/${done.id}/`)
        expect(input.kind).toBe('video')
        expect(input.contentType).toBe('video/mp4')
        expect(input.durationMs).toBe(4000)
        return { ok: true, projectId: input.projectId, clipId: 'clip_from_studio' }
      },
    })
    expect(sent).toEqual({ ok: true, projectId: 'proj_1', clipId: 'clip_from_studio' })
  })

  it('stores an uploaded reference asset and uses it for image-to-video', async () => {
    const puts: Array<{ key: string; type: string; bytes: Buffer }> = []
    const created: KieCreateRequest[] = []
    const kie = mockKie({
      created,
      async uploadImage() {
        return 'https://kie.example.test/hosted.png'
      },
      async downloadUrl(url) {
        if (url.includes('storage.example.test')) return { bytes: Buffer.from('ref'), contentType: 'image/png' }
        return { bytes: Buffer.from('vid'), contentType: 'video/mp4' }
      },
    })
    const svc = makeSvc({ kie, puts })
    const asset = await createStudioAsset(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      bytes: Buffer.from('ref-bytes'),
      contentType: 'image/png',
    })
    expect(asset.id).toBeTruthy()
    const job = await createStudioJob(svc, {
      workspaceId: 'ws_1',
      userId: 'user_1',
      body: {
        modelId: 'hailuo-2.3',
        mode: 'image_to_video',
        prompt: 'the still photo begins to move',
        startFrameAssetId: asset.id,
      },
    })
    expect(job.status).toBe('running')
    expect(created[0].model).toBe('hailuo/2-3-image-to-video-standard')
    expect(created[0].input.image_url).toBe('https://kie.example.test/hosted.png')
  })

  it('rejects a bad asset mime and a missing asset id', async () => {
    const svc = makeSvc()
    await expect(
      createStudioAsset(svc, {
        workspaceId: 'ws_1',
        userId: 'user_1',
        bytes: Buffer.from('x'),
        contentType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' })
    await expect(
      createStudioJob(svc, {
        workspaceId: 'ws_1',
        userId: 'user_1',
        body: {
          modelId: 'hailuo-2.3',
          mode: 'image_to_video',
          prompt: 'the still photo begins to move',
          startFrameAssetId: 'missing',
        },
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' })
  })
})
