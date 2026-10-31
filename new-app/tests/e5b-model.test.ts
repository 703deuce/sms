import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { applyWordFixesByIndex, defaultEdits, editsPayloadForSave, isDefaultEdits, normalizeEdits, type ClipEditsV2 } from '@/lib/clips/edits'
import { normalizeAudioEdits } from '@/lib/clips/audio'
import { normalizeMediaSources, pruneSources, type ClipMediaSource } from '@/lib/clips/editor/sources'
import { addMediaToLane, insertMediaAt, sfxPlacementId, type ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { timebaseFor } from '@/lib/clips/editor/clip-timeline'
import {
  baseToDisplayMs,
  displayToBase,
  insertWindows,
  insertsTotalMs,
  normalizeInserts,
  patchInsert,
  removeInsert,
  shiftCueToDisplay,
} from '@/lib/clips/editor/inserts'
import { insertWords, isMediaWordIndex, mediaBucket, mediaWordIndex, mergeMediaWords, type MediaTranscript } from '@/lib/clips/editor/media-words'
import { crossedCue, insertCues } from '@/lib/clips/editor/insert-playback'
import { estimateMediaTranscribeUsd, mediaTranscribeCredits, mediaTranscribeUsdPerMin } from '@/lib/clips/media-transcribe-cost'

const bounds = { clipStartMs: 10_000, clipEndMs: 40_000 }
const base = (): ClipEditsV2 => defaultEdits(bounds)
let n = 0
const newId = () => `ins${++n}`

const UPLOAD: ClipMediaSource = { id: 'upl_v', ref: 'upload', refId: 'upl_v', mediaType: 'video', label: 'drone.mp4', durationMs: 8000 }
const STILL: ClipMediaSource = { id: 'upl_i', ref: 'upload', refId: 'upl_i', mediaType: 'image', label: 'logo.png' }
const AUDIO: ClipMediaSource = { id: 'upl_a', ref: 'upload', refId: 'upl_a', mediaType: 'audio', label: 'song.mp3' }
const ANGLE: ClipMediaSource = { id: 'trk_b', ref: 'take', refId: 'trk_b', mediaType: 'video', label: 'Guest cam', syncMs: -1500 }
const SOURCES = [UPLOAD, STILL, AUDIO, ANGLE]

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

const done = (refId: string, words: MediaTranscript['words']): MediaTranscript =>
  ({ id: `t_${refId}`, ref: 'upload', refId, status: 'done', words, durationMs: 8000 }) as unknown as MediaTranscript

describe('E5b inserts model', () => {
  it('normalizes: known video/image sources only, clamps length, stills are silent', () => {
    const got = normalizeInserts(
      [
        { id: 'a', sourceId: 'upl_v', atSrcMs: 12_000.4, inMs: 6000, durMs: 9000 },
        { id: 'b', sourceId: 'upl_i', atSrcMs: 15_000, durMs: 2000, inMs: 500, audio: 'source' },
        { id: 'c', sourceId: 'upl_a', atSrcMs: 15_000, durMs: 2000 },
        { id: 'd', sourceId: 'gone', atSrcMs: 15_000, durMs: 2000 },
        { id: 'e', sourceId: 'upl_v', atSrcMs: 15_000, durMs: 100 },
        { id: 'a', sourceId: 'upl_v', atSrcMs: 1, durMs: 1000 },
        { id: 'f', sourceId: 'upl_v', atSrcMs: 1, durMs: 1000, append: true, fit: 'contain', audio: 'mute' },
      ],
      SOURCES,
    )
    expect(got).toEqual([
      { id: 'a', sourceId: 'upl_v', atSrcMs: 12_000, inMs: 6000, durMs: 2000 },
      { id: 'b', sourceId: 'upl_i', atSrcMs: 15_000, inMs: 0, durMs: 2000, audio: 'mute' },
      { id: 'f', sourceId: 'upl_v', atSrcMs: 1, append: true, inMs: 0, durMs: 1000, audio: 'mute', fit: 'contain' },
    ])
    expect(normalizeInserts([], SOURCES)).toBeUndefined()
  })

  it('ripples: windows, display ↔ base mapping, cue shift', () => {
    const segs: [number, number][] = [
      [10_000, 20_000],
      [25_000, 40_000],
    ] // 25 s base
    const inserts = normalizeInserts(
      [
        { id: 'end', sourceId: 'upl_v', atSrcMs: 0, append: true, durMs: 1000 },
        { id: 'mid', sourceId: 'upl_v', atSrcMs: 15_000, durMs: 2000 },
        { id: 'cut', sourceId: 'upl_i', atSrcMs: 22_000, durMs: 3000 }, // inside the cut → next kept start
        { id: 'mid2', sourceId: 'upl_i', atSrcMs: 15_000, durMs: 500 },
      ],
      SOURCES,
    )!
    const w = insertWindows(segs, inserts)
    expect(w.map((x) => [x.id, x.baseMs, x.startMs, x.endMs])).toEqual([
      ['mid', 5000, 5000, 7000],
      ['mid2', 5000, 7000, 7500],
      ['cut', 10_000, 12_500, 15_500],
      ['end', 25_000, 30_500, 31_500],
    ])
    expect(insertsTotalMs(inserts)).toBe(6500)
    expect(baseToDisplayMs(w, 4999)).toBe(4999)
    expect(baseToDisplayMs(w, 5000)).toBe(7500)
    expect(baseToDisplayMs(w, 24_999)).toBe(24_999 + 5500)
    expect(displayToBase(w, 6000)).toEqual({ baseMs: 5000, insert: { id: 'mid', offsetMs: 1000 } })
    expect(displayToBase(w, 8000)).toEqual({ baseMs: 5500, insert: null })
    expect(displayToBase(w, 31_000).insert?.id).toBe('end')
    expect(shiftCueToDisplay(w, 4000, 6000)).toEqual([4000, 8500]) // a cue spanning the point stretches over the insert (worker shift_srt: same)
  })

  it('patch / remove keep the normalizer rules', () => {
    const ins = normalizeInserts([{ id: 'a', sourceId: 'upl_v', atSrcMs: 12_000, durMs: 3000 }], SOURCES)
    expect(patchInsert(ins, 'a', { audio: 'mute', fit: 'contain', durMs: 50_000 }, SOURCES)).toEqual([
      { id: 'a', sourceId: 'upl_v', atSrcMs: 12_000, inMs: 0, durMs: 8000, audio: 'mute', fit: 'contain' },
    ])
    expect(removeInsert(ins, 'a')).toBeUndefined()
  })

  it('Insert / Append at the playhead, saved through the edits normalizer', () => {
    const e = base()
    const r = insertMediaAt(e, item({}), 15_000, 'insert', newId)
    expect(r.message).toBe('Inserted 8.0 s, everything after it moved right')
    expect(r.edits?.inserts).toEqual([{ id: expect.any(String), sourceId: 'upl_v', atSrcMs: 15_000, inMs: 0, durMs: 8000 }])
    const a = insertMediaAt(r.edits!, item({ refId: 'upl_i', mediaType: 'image', durationMs: null }), 0, 'append', newId)
    expect(a.message).toContain('Appended 3.0 s')
    expect(a.edits?.inserts?.[1]).toMatchObject({ sourceId: 'upl_i', append: true, atSrcMs: e.trim.out, durMs: 3000, audio: 'mute' })
    // A synced angle plays from its own start (no sync offset on the source used by an insert).
    const s = insertMediaAt(e, item({ ref: 'take', refId: 'trk_b', syncMs: -1500, syncStatus: 'done' }), 0, 'insert', newId)
    expect(s.edits?.inserts?.[0]?.atSrcMs).toBe(e.trim.in)
    expect(insertMediaAt(e, item({ mediaType: 'audio' }), 0, 'insert', newId).edits).toBeNull()

    const saved = normalizeEdits(JSON.parse(JSON.stringify(a.edits)), bounds)
    expect(saved.inserts).toEqual(a.edits?.inserts)
    expect(isDefaultEdits(saved, bounds)).toBe(false)
    expect(editsPayloadForSave(base()).inserts ?? null).toBeNull()
    // Sources an insert uses survive pruning.
    expect(pruneSources(saved.sources, undefined, undefined, saved.inserts)?.map((x) => x.id).sort()).toEqual(['upl_i', 'upl_v'])
    expect(pruneSources(saved.sources, undefined, undefined, undefined)).toBeUndefined()
  })
})

describe('E5b SFX placed more than once', () => {
  it('adds a new cue per placement with unique ids', () => {
    const e = base()
    const tb = timebaseFor(e)
    const s1 = addMediaToLane(e, tb, item({ refId: 'upl_s', mediaType: 'audio' }), 'sfx', 1000, newId)
    const s2 = addMediaToLane(s1.edits!, tb, item({ refId: 'upl_s', mediaType: 'audio' }), 'sfx', 2000, newId)
    const s3 = addMediaToLane(s2.edits!, tb, item({ refId: 'upl_s', mediaType: 'audio' }), 'sfx', 3000, newId)
    expect(s3.edits?.audio?.sfx.map((c) => [c.generationId, c.uploadId, c.atMs])).toEqual([
      ['upl_s', 'upl_s', 1000],
      ['upl_s~2', 'upl_s', 2000],
      ['upl_s~3', 'upl_s', 3000],
    ])
    expect(sfxPlacementId('u', ['u', 'u~2', 'u~4'])).toBe('u~3')
    // Survives the save normalizer; legacy duplicate ids get re-suffixed.
    const a = normalizeAudioEdits(JSON.parse(JSON.stringify(s3.edits!.audio)))
    expect(a.sfx.map((c) => c.generationId)).toEqual(['upl_s', 'upl_s~2', 'upl_s~3'])
    const dup = normalizeAudioEdits({ sfx: [{ uploadId: 'upl_s', atMs: 1 }, { uploadId: 'upl_s', atMs: 2 }] })
    expect(new Set(dup.sfx.map((c) => c.generationId)).size).toBe(2)
    expect(dup.sfx.every((c) => c.uploadId === 'upl_s')).toBe(true)
  })
})

describe('E5b media transcripts', () => {
  it('word index is stable and outside the main transcript range', () => {
    expect(mediaBucket('upl_v')).toBe(mediaBucket('upl_v'))
    expect(mediaWordIndex('upl_v', 3)).toBe(1_000_000_000 + mediaBucket('upl_v') * 1_000_000 + 3)
    expect(isMediaWordIndex(mediaWordIndex('trk_b', 0))).toBe(true)
    expect(isMediaWordIndex(42)).toBe(false)
  })

  it("joins media words where the clip's own sound plays (editable through wordFixes)", () => {
    const main = [
      { w: 'one', s: 11, e: 11.4, i: 0 },
      { w: 'two', s: 12.5, e: 12.9, i: 1 },
      { w: 'three', s: 14.2, e: 14.6, i: 2 },
    ]
    const edits = {
      sources: [UPLOAD],
      sourceSegments: [{ id: 's', sourceId: 'upl_v', startMs: 12_000, endMs: 14_000, inMs: 500, audio: 'source' as const }],
    }
    const tr = [done('upl_v', [{ w: 'hello', s: 0.6, e: 0.9 }, { w: 'world', s: 1.0, e: 1.3 }, { w: 'late', s: 3.0, e: 3.2 }])]
    const merged = mergeMediaWords(main, edits, tr)
    expect(merged.map((w) => [w.w, w.s, w.e])).toEqual([
      ['one', 11, 11.4],
      ['hello', 12.1, 12.4],
      ['world', 12.5, 12.8],
      ['three', 14.2, 14.6],
    ])
    const i = mediaWordIndex('upl_v', 0)
    expect(merged[1]!.i).toBe(i)
    expect(applyWordFixesByIndex(merged, { [String(i)]: 'Hello,' })[1]!.w).toBe('Hello,')
    // 'main' sound or no transcript → unchanged.
    expect(mergeMediaWords(main, { ...edits, sourceSegments: [{ ...edits.sourceSegments[0]!, audio: 'main' as const }] }, tr)).toBe(main)
    expect(mergeMediaWords(main, edits, [])).toBe(main)
  })

  it('insert words land on the display timeline', () => {
    const segs: [number, number][] = [[10_000, 40_000]]
    const ins = normalizeInserts([{ id: 'a', sourceId: 'upl_v', atSrcMs: 20_000, inMs: 500, durMs: 2000 }], SOURCES)
    const w = insertWords(insertWindows(segs, ins), SOURCES, [done('upl_v', [{ w: 'hi', s: 0.6, e: 0.9 }, { w: 'gone', s: 3, e: 3.2 }])], {
      [String(mediaWordIndex('upl_v', 0))]: 'Hi!',
    })
    expect(w).toEqual([{ w: 'Hi!', startMs: 10_100, endMs: 10_400, i: mediaWordIndex('upl_v', 0), insertId: 'a' }])
  })

  it('cost is shown from duration (whole seconds, 15 s minimum)', () => {
    expect(estimateMediaTranscribeUsd(60_000)).toBeCloseTo(0.0043, 6)
    expect(estimateMediaTranscribeUsd(1000)).toBeCloseTo((15 / 60) * 0.0043, 6)
    expect(estimateMediaTranscribeUsd(600_000, 0.0059)).toBeCloseTo(0.059, 6)
    // users see credits only: 1 credit per started minute, 15 s minimum
    expect(mediaTranscribeCredits(0)).toBe(1)
    expect(mediaTranscribeCredits(60_000)).toBe(1)
    expect(mediaTranscribeCredits(95_000)).toBe(2)
    expect(mediaTranscribeCredits(600_000)).toBe(10)
    expect(mediaTranscribeUsdPerMin('abc')).toBe(0.0043)
    expect(mediaTranscribeUsdPerMin('0.0059')).toBe(0.0059)
  })
})

describe('E5b preview cues', () => {
  it('fires when playback crosses an insert point, including over a cut, never on seeks', () => {
    const segs: [number, number][] = [
      [10_000, 20_000],
      [25_000, 40_000],
    ]
    const ins = normalizeInserts(
      [
        { id: 'mid', sourceId: 'upl_v', atSrcMs: 15_000, durMs: 2000 },
        { id: 'cut', sourceId: 'upl_v', atSrcMs: 22_000, durMs: 2000 },
        { id: 'end', sourceId: 'upl_v', atSrcMs: 0, append: true, durMs: 2000 },
      ],
      SOURCES,
    )!
    const cues = insertCues(segs, insertWindows(segs, ins), new Set(['end']))
    expect(cues.map((c) => [c.resumeSrcMs, c.append, c.windows.map((w) => w.id)])).toEqual([
      [15_000, false, ['mid']],
      [25_000, false, ['cut']],
      [40_000, true, ['end']],
    ])
    expect(crossedCue(cues, 14_980, 15_010)?.windows[0]!.id).toBe('mid')
    expect(crossedCue(cues, 19_990, 25_000)?.windows[0]!.id).toBe('cut') // jump over the cut
    expect(crossedCue(cues, 11_000, 16_000)).toBeNull() // seek
    expect(crossedCue(cues, 15_010, 14_000)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Preview ↔ export parity fixture (worker/tests/test_e5b_parity.py asserts the same JSON)
// Regenerate after an intentional change: WRITE_E5B_FIXTURE=1 npx vitest run e5b-model
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURE = path.resolve(here, '../../worker/tests/fixtures/e5b_parity.json')

function parityCases() {
  const words = [
    { w: 'a', s: 10.2, e: 10.5, i: 0 },
    { w: 'b', s: 12.25, e: 12.5, i: 1 },
    { w: 'c', s: 13.0, e: 13.4, i: 2 },
    { w: 'd', s: 30.0, e: 30.3, i: 3 },
  ]
  const tr = [
    done('upl_v', [{ w: 'x', s: 0.5005, e: 0.7 }, { w: 'y', s: 1.2, e: 1.5, p: 0.9 }, { w: ' ', s: 1.6, e: 1.7 }, { w: 'z', s: 2.5, e: 2.9 }]),
    done('trk_b', [{ w: 'g1', s: 10.0, e: 10.4 }, { w: 'g2', s: 11.0, e: 11.3 }]),
  ]
  const raw = [
    {
      segs: [[10_000, 40_000]],
      sources: SOURCES,
      inserts: [{ id: 'a', sourceId: 'upl_v', atSrcMs: 20_000, inMs: 400, durMs: 2000 }],
      sourceSegments: [{ id: 's', sourceId: 'upl_v', startMs: 12_000, endMs: 14_000, inMs: 0, audio: 'source' }],
      wordFixes: { [String(mediaWordIndex('upl_v', 1))]: 'Y!' },
    },
    {
      segs: [
        [10_000, 20_000],
        [25_000, 40_000],
      ],
      sources: SOURCES,
      inserts: [
        { id: 'e', sourceId: 'upl_i', atSrcMs: 0, append: true, durMs: 1500 },
        { id: 'b', sourceId: 'upl_v', atSrcMs: 22_000, durMs: 3000, fit: 'contain' },
        { id: 'c', sourceId: 'trk_b', atSrcMs: 15_000, inMs: 9000, durMs: 3000 },
        { id: 'd', sourceId: 'upl_v', atSrcMs: 15_000, durMs: 900, audio: 'mute' },
        { id: 'x', sourceId: 'upl_a', atSrcMs: 15_000, durMs: 900 },
      ],
      sourceSegments: [{ id: 'g', sourceId: 'trk_b', startMs: 12_000, endMs: 14_000 }],
      wordFixes: {},
    },
  ]
  return raw.map((c) => {
    const sources = normalizeMediaSources(c.sources)!
    const inserts = normalizeInserts(c.inserts, sources)
    const windows = insertWindows(c.segs as [number, number][], inserts)
    const sourceSegments = c.sourceSegments as never
    return {
      input: c,
      words,
      transcripts: Object.fromEntries(tr.map((t) => [t.refId, t.words])),
      inserts,
      windows,
      merged: mergeMediaWords(words, { sources, sourceSegments: normalizeEdits({ ...base(), sources, sourceSegments }, bounds).sourceSegments }, tr),
      insertWords: insertWords(windows, sources, tr, c.wordFixes),
      buckets: { upl_v: mediaBucket('upl_v'), trk_b: mediaBucket('trk_b'), 'clip_ünï': mediaBucket('clip_ünï') },
    }
  })
}

describe('E5b parity fixture', () => {
  it('matches worker fixture', () => {
    const cases = parityCases()
    const body = JSON.stringify({ cases }, null, 2) + '\n'
    if (process.env.WRITE_E5B_FIXTURE === '1' || !existsSync(FIXTURE)) writeFileSync(FIXTURE, body)
    expect(JSON.parse(readFileSync(FIXTURE, 'utf8'))).toEqual(JSON.parse(body))
  })
})
