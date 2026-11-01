import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { timebaseFor, buildTimelineItems } from '@/lib/clips/editor/clip-timeline'
import { defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import { normalizeBrollItems } from '@/lib/clips/broll'
import {
  applyMulticamSegments,
  buildMulticamSegments,
  clearSourceRange,
  normalizeMediaSources,
  normalizeMulticam,
  normalizeSourceSegments,
  patchSourceSegment,
  pruneSources,
  segmentAudio,
  segmentMediaMs,
  setSourceSegment,
  sourceRenderWindows,
  sourceSegmentAt,
  sourceSegmentWindows,
  speakersInWords,
  type ClipMediaSource,
  type MulticamWord,
  type SourceSegment,
} from '@/lib/clips/editor/sources'
import { addMediaToLane, mediaLanesFor, replaceVideoRange, type ProjectMediaItem } from '@/lib/clips/editor/media-add'

const bounds = { clipStartMs: 10_000, clipEndMs: 40_000 }
const base = (): ClipEditsV2 => defaultEdits(bounds)
let n = 0
const newId = () => `id${++n}`

const ANGLE: ClipMediaSource = { id: 'trk_b', ref: 'take', refId: 'trk_b', mediaType: 'video', label: 'Guest cam', syncMs: -1500 }
const UPLOAD: ClipMediaSource = { id: 'upl_v', ref: 'upload', refId: 'upl_v', mediaType: 'video', label: 'drone.mp4', durationMs: 8000 }
const STILL: ClipMediaSource = { id: 'upl_i', ref: 'upload', refId: 'upl_i', mediaType: 'image', label: 'logo.png' }
const SOURCES = [ANGLE, UPLOAD, STILL]

const item = (over: Partial<ProjectMediaItem>): ProjectMediaItem => ({
  id: 'm1',
  ref: 'upload',
  refId: 'upl_v',
  mediaType: 'video',
  label: 'drone.mp4',
  durationMs: 8000,
  width: 1920,
  height: 1080,
  url: 'https://x/y',
  syncMs: null,
  syncStatus: 'none',
  ...over,
})

describe('E5 sources model', () => {
  it('normalizes sources: drops bad refs / dupes, images never synced', () => {
    const got = normalizeMediaSources([
      ANGLE,
      { ...ANGLE },
      { id: 'x', ref: 'http', refId: 'x', mediaType: 'video' },
      { id: 'bad id!', ref: 'upload', refId: 'bad id!', mediaType: 'video' },
      { ...STILL, syncMs: 300 },
      { ref: 'upload', refId: 'upl_a', mediaType: 'audio', durationMs: '4200' },
    ])
    expect(got).toEqual([ANGLE, STILL, { id: 'upl_a', ref: 'upload', refId: 'upl_a', mediaType: 'audio', durationMs: 4200 }])
    expect(normalizeMediaSources([])).toBeUndefined()
  })

  it('normalizes segments: unknown / audio sources dropped, sorted, later wins on overlap', () => {
    const segs = normalizeSourceSegments(
      [
        { id: 'b', sourceId: 'upl_v', startMs: 15_000, endMs: 18_000, inMs: 500, audio: 'mix' },
        { id: 'a', sourceId: 'trk_b', startMs: 12_000, endMs: 16_000 },
        { id: 'c', sourceId: 'nope', startMs: 20_000, endMs: 21_000 },
        { id: 'd', sourceId: 'upl_i', startMs: 30_000, endMs: 30_050 },
        { id: 'e', sourceId: 'upl_i', startMs: 31_000, endMs: 33_000, inMs: 4, audio: 'source', fit: 'contain' },
      ],
      SOURCES,
    )
    expect(segs).toEqual([
      { id: 'a', sourceId: 'trk_b', startMs: 12_000, endMs: 15_000 },
      { id: 'b', sourceId: 'upl_v', startMs: 15_000, endMs: 18_000, inMs: 500, audio: 'mix' },
      { id: 'e', sourceId: 'upl_i', startMs: 31_000, endMs: 33_000, fit: 'contain' },
    ])
  })

  it('media time: synced angle follows the main clock; unsynced uses inMs; stills are frame 0', () => {
    const synced: SourceSegment = { id: 's', sourceId: 'trk_b', startMs: 12_000, endMs: 15_000 }
    expect(segmentMediaMs(synced, ANGLE, 13_000)).toBe(11_500)
    expect(segmentAudio(synced, ANGLE)).toBe('main')
    const slipped: SourceSegment = { ...synced, inMs: 2000 }
    expect(segmentMediaMs(slipped, ANGLE, 13_000)).toBe(3000)
    const up: SourceSegment = { id: 'u', sourceId: 'upl_v', startMs: 20_000, endMs: 22_000, inMs: 1000 }
    expect(segmentMediaMs(up, UPLOAD, 21_500)).toBe(2500)
    expect(segmentAudio(up, UPLOAD)).toBe('source')
    expect(segmentMediaMs({ id: 'i', sourceId: 'upl_i', startMs: 1, endMs: 999 }, STILL, 500)).toBe(0)
    expect(segmentAudio({ id: 'i', sourceId: 'upl_i', startMs: 1, endMs: 999, audio: 'source' }, STILL)).toBe('main')
  })

  it('set / clear / patch keep media anchored on the right piece', () => {
    const one = setSourceSegment(undefined, { id: 'u', sourceId: 'upl_v', startMs: 20_000, endMs: 26_000, inMs: 0 }, SOURCES)
    const two = setSourceSegment(one, { id: 'i', sourceId: 'upl_i', startMs: 22_000, endMs: 23_000 }, SOURCES)
    expect(two).toEqual([
      { id: 'u', sourceId: 'upl_v', startMs: 20_000, endMs: 22_000, inMs: 0 },
      { id: 'i', sourceId: 'upl_i', startMs: 22_000, endMs: 23_000 },
      { id: 'u~23000', sourceId: 'upl_v', startMs: 23_000, endMs: 26_000, inMs: 3000 },
    ])
    expect(sourceSegmentAt(two, 22_500)?.id).toBe('i')
    expect(sourceSegmentAt(two, 26_000)).toBeUndefined()
    expect(clearSourceRange(two, 0, 99_999)).toBeUndefined()
    const patched = patchSourceSegment(two, 'i', { fit: 'contain' }, SOURCES)
    expect(patched?.find((s) => s.id === 'i')).toEqual({ id: 'i', sourceId: 'upl_i', startMs: 22_000, endMs: 23_000, fit: 'contain' })
    expect(pruneSources(SOURCES, two)?.map((s) => s.id)).toEqual(['upl_v', 'upl_i'])
  })

  it('normalizeEdits keeps the E5 fields; payload clears them; preview reuse is off', () => {
    const raw = {
      ...base(),
      sources: SOURCES,
      sourceSegments: [{ id: 's1', sourceId: 'trk_b', startMs: 12_000, endMs: 14_000 }],
      multicam: { speakerSources: { '0': 'main', '1': 'trk_b', x: 'y' }, minHoldMs: 10, wideEveryMs: 9e9 },
    }
    const e = normalizeEdits(raw, bounds)
    expect(e.sources).toEqual(SOURCES)
    expect(e.sourceSegments).toEqual([{ id: 's1', sourceId: 'trk_b', startMs: 12_000, endMs: 14_000 }])
    expect(e.multicam).toEqual({ speakerSources: { '0': 'main', '1': 'trk_b' }, minHoldMs: 2000, wideEveryMs: 120_000 })
    expect(isDefaultEdits(e, bounds)).toBe(false)
    const cleared = editsPayloadForSave(base())
    expect(cleared.sources).toBeNull()
    expect(cleared.sourceSegments).toBeNull()
    expect(cleared.multicam).toBeNull()
    expect(normalizeMulticam({})).toBeUndefined()
  })

  it('B-roll / music / SFX accept uploads and keep their ids', () => {
    const b = normalizeBrollItems(
      [
        { id: 'b1', source: 'upload', uploadId: 'upl_v', startMs: 1000, endMs: 3000 },
        { id: 'b2', source: 'upload', uploadId: 'upl_i', still: true, startMs: 4000, endMs: 6000 },
        { id: 'b3', source: 'upload', uploadId: '../etc', startMs: 4000, endMs: 6000 },
      ],
      20_000,
    )
    expect(b).toEqual([
      { id: 'b1', source: 'upload', uploadId: 'upl_v', startMs: 1000, endMs: 3000 },
      { id: 'b2', source: 'upload', uploadId: 'upl_i', still: true, startMs: 4000, endMs: 6000 },
    ])
    const a = normalizeAudioEdits({ music: { uploadId: 'upl_m', startMs: 0 }, sfx: [{ uploadId: 'upl_s', atMs: 500 }, { generationId: 'gen_1', atMs: 10 }] })
    expect(a.music?.generationId).toBe('upl_m')
    expect(a.music?.uploadId).toBe('upl_m')
    expect(a.sfx.map((s) => [s.generationId, s.uploadId])).toEqual([
      ['upl_s', 'upl_s'],
      ['gen_1', undefined],
    ])
  })
})

describe('E5 add media to timeline', () => {
  const e0 = (): ClipEditsV2 => ({ ...base(), cutRanges: [[20_000, 22_000]] })

  it('lanes per media type', () => {
    expect(mediaLanesFor(item({}))).toEqual(['video', 'broll'])
    expect(mediaLanesFor(item({ mediaType: 'audio' }))).toEqual(['music', 'sfx'])
    expect(mediaLanesFor(item({ ref: 'take' }))).toEqual(['video'])
    expect(mediaLanesFor(item({ isMain: true }))).toEqual([])
  })

  it('video: unsynced upload from the playhead, clamped to the Video item; output length unchanged', () => {
    const e = e0()
    const tb = timebaseFor(e)
    const res = addMediaToLane(e, tb, item({}), 'video', 5000, newId)
    expect(res.edits?.sourceSegments).toEqual([{ id: expect.any(String), sourceId: 'upl_v', startMs: 15_000, endMs: 20_000, inMs: 0 }])
    expect(timebaseFor(res.edits!).durationMs).toBe(tb.durationMs)
    const lanes = buildTimelineItems({ edits: res.edits!, previewEdits: res.edits! })
    expect(lanes.video.length).toBe(timebaseFor(e).segs.length)
  })

  it('video: a synced angle runs to the end of the Video item; image = 3 s still', () => {
    const e = e0()
    const tb = timebaseFor(e)
    const ang = addMediaToLane(e, tb, item({ ref: 'take', refId: 'trk_b', syncMs: -1500, syncStatus: 'clock' }), 'video', 12_000, newId)
    expect(ang.edits?.sourceSegments).toEqual([{ id: expect.any(String), sourceId: 'trk_b', startMs: 24_000, endMs: 40_000 }])
    expect(ang.edits?.sources?.[0]?.syncMs).toBe(-1500)
    const img = addMediaToLane(e, tb, item({ refId: 'upl_i', mediaType: 'image', durationMs: null }), 'video', 0, newId)
    expect(img.edits?.sourceSegments).toEqual([{ id: expect.any(String), sourceId: 'upl_i', startMs: 10_000, endMs: 13_000 }])
  })

  it('broll / music / sfx', () => {
    const e = e0()
    const tb = timebaseFor(e)
    const b = addMediaToLane(e, tb, item({ refId: 'upl_i', mediaType: 'image' }), 'broll', 1000, newId)
    expect(b.edits?.broll?.[0]).toMatchObject({ source: 'upload', uploadId: 'upl_i', still: true, startMs: 1000, endMs: 4000 })
    const m = addMediaToLane(e, tb, item({ refId: 'upl_m', mediaType: 'audio', durationMs: 60_000 }), 'music', 2000, newId)
    expect(m.edits?.audio?.music).toMatchObject({ generationId: 'upl_m', uploadId: 'upl_m', startMs: 2000, endMs: tb.durationMs })
    const s = addMediaToLane(e, tb, item({ refId: 'upl_s', mediaType: 'audio' }), 'sfx', 3000, newId)
    const s2 = addMediaToLane(s.edits!, tb, item({ refId: 'upl_s', mediaType: 'audio' }), 'sfx', 4000, newId)
    // E5b: the same upload can be placed again (was: moved to the playhead).
    expect(s2.edits?.audio?.sfx).toEqual([
      { generationId: 'upl_s', uploadId: 'upl_s', atMs: 3000, volume: 0.8 },
      { generationId: 'upl_s~2', uploadId: 'upl_s', atMs: 4000, volume: 0.8 },
    ])
    expect(addMediaToLane(e, tb, item({ mediaType: 'audio' }), 'video', 0, newId).edits).toBeNull()
    // Round-trips through the normalizer (what the PATCH stores).
    const saved = normalizeEdits(JSON.parse(JSON.stringify(b.edits)), bounds)
    expect(saved.broll?.[0]).toMatchObject({ source: 'upload', uploadId: 'upl_i', still: true })
  })

  it('replace the selected Video item with an angle (per-segment switch)', () => {
    const res = replaceVideoRange(base(), item({ ref: 'take', refId: 'trk_b', syncMs: 250 }), 11_000, 19_000, newId)
    expect(res.edits?.sourceSegments).toEqual([{ id: expect.any(String), sourceId: 'trk_b', startMs: 11_000, endMs: 19_000 }])
  })
})

/** 2-camera podcast fixture: speaker 0 (host, main cam) and 1 (guest, angle). */
export function twoCamWords(): MulticamWord[] {
  const out: MulticamWord[] = []
  let t = 10.0
  const turns: [number, number][] = [
    [0, 6], [1, 8], [0, 4], [1, 2], [0, 7], [1, 9],
  ]
  let i = 0
  for (const [spk, count] of turns) {
    for (let k = 0; k < count; k++) {
      out.push({ s: Math.round(t * 1000) / 1000, e: Math.round((t + 0.4) * 1000) / 1000, spk, i: i++ })
      t += 0.5
    }
    t += 0.333
  }
  return out
}

describe('E5 multicam (existing D8 rules)', () => {
  const words = twoCamWords()
  const mc = { speakerSources: { '0': 'main', '1': 'trk_b' }, minHoldMs: 2000 }

  it('switches to the guest angle exactly on diarization boundaries (±1 frame)', () => {
    const segs = buildMulticamSegments(words, 10_000, 40_000, mc, [ANGLE])
    expect(segs.length).toBeGreaterThan(0)
    const guestStarts = words.filter((w, k) => w.spk === 1 && (k === 0 || words[k - 1]!.spk !== 1)).map((w) => Math.round(w.s * 1000))
    for (const s of segs) {
      expect(s.sourceId).toBe('trk_b')
      expect(s.auto).toBe(true)
      expect(s.audio).toBe('main')
      expect(guestStarts.some((g) => Math.abs(g - s.startMs) <= 1000 / 30)).toBe(true)
    }
    // The 2-word guest turn (1 s) is below the D8 hold → stays on the main camera.
    const shortTurn = guestStarts[1]!
    expect(segs.some((s) => s.startMs === shortTurn)).toBe(false)
    expect(speakersInWords(words, 10_000, 40_000)).toEqual(['1', '0'])
  })

  it('regenerating replaces only auto segments; manual segments win', () => {
    const manual: SourceSegment = { id: 'man', sourceId: 'upl_v', startMs: 14_000, endMs: 16_000, inMs: 0 }
    const gen = buildMulticamSegments(words, 10_000, 40_000, mc, [ANGLE, UPLOAD])
    const first = applyMulticamSegments([manual], gen, 10_000, 40_000, [ANGLE, UPLOAD])!
    expect(first.find((s) => s.id === 'man')).toEqual(manual)
    for (const s of first) if (s.auto) expect(s.endMs <= 14_000 || s.startMs >= 16_000).toBe(true)
    const again = applyMulticamSegments(first, gen, 10_000, 40_000, [ANGLE, UPLOAD])!
    expect(again).toEqual(first)
    const cleared = applyMulticamSegments(first, [], 10_000, 40_000, [ANGLE, UPLOAD])
    expect(cleared).toEqual([manual])
  })

  it('timeline windows follow cuts (a segment spanning a cut shows twice)', () => {
    const e: ClipEditsV2 = { ...base(), cutRanges: [[20_000, 22_000]], sources: SOURCES, sourceSegments: [{ id: 'x', sourceId: 'trk_b', startMs: 19_000, endMs: 23_000 }] }
    const w = sourceSegmentWindows(timebaseFor(e), e.sourceSegments)
    expect(w.map((p) => [p.startMs, p.endMs, p.srcStartMs])).toEqual([
      [9000, 10_000, 19_000],
      [10_000, 11_000, 22_000],
    ])
  })
})

// ---------------------------------------------------------------------------
// Preview ↔ export parity fixture (worker/tests/test_e5_parity.py asserts the same JSON)
// Regenerate after an intentional change: WRITE_E5_FIXTURE=1 npx vitest run e5-model
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/e5_parity.json')

function parityCases() {
  const raw = [
    { sources: SOURCES, sourceSegments: [{ id: 'a', sourceId: 'trk_b', startMs: 12_000, endMs: 16_000 }], win: [10_000, 40_000] },
    { sources: SOURCES, sourceSegments: [{ id: 'a', sourceId: 'trk_b', startMs: 12_000, endMs: 16_000, inMs: 700, audio: 'mix' }], win: [13_000, 30_000] },
    {
      sources: SOURCES,
      sourceSegments: [
        { id: 'u', sourceId: 'upl_v', startMs: 20_000, endMs: 26_000, inMs: 250, fit: 'contain' },
        { id: 'i', sourceId: 'upl_i', startMs: 22_000, endMs: 23_000, audio: 'source' },
        { id: 'z', sourceId: 'gone', startMs: 30_000, endMs: 31_000 },
      ],
      win: [10_000, 40_000],
    },
    { sources: [{ ...ANGLE, syncMs: 900 }], sourceSegments: [{ id: 'a', sourceId: 'trk_b', startMs: 5000, endMs: 50_000 }], win: [10_000, 40_000] },
  ]
  return raw.map((c) => {
    const sources = normalizeMediaSources(c.sources)
    const sourceSegments = normalizeSourceSegments(c.sourceSegments, sources)
    return { input: c, sources, sourceSegments, windows: sourceRenderWindows({ sources, sourceSegments }, c.win[0]!, c.win[1]!) }
  })
}

describe('E5 parity fixture', () => {
  it('matches worker fixture', () => {
    const cases = parityCases()
    const body = JSON.stringify({ cases }, null, 2) + '\n'
    if (process.env.WRITE_E5_FIXTURE === '1' || !existsSync(FIXTURE)) writeFileSync(FIXTURE, body)
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(JSON.parse(body))
  })
})
