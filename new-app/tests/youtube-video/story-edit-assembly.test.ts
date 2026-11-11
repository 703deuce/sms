import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { buildYoutubeStoryEditAssembly } from '@/lib/youtube-video/story-edit-assembly'
import { storyCutsInEditorialOrder } from '@/lib/youtube-video/assemble'
import { resultStoryFields } from '@/lib/youtube-video/chapters'

const bounds = { clipStartMs: 1000, clipEndMs: 8000, trimMinMs: 0, trimMaxMs: 8000 }
const uploads = [
  { id: 'upl_a', label: 'First source', durationMs: 300000 },
  { id: 'upl_b', label: 'Second source', durationMs: 300000 },
  { id: 'upl_a', label: 'First source', durationMs: 300000 },
]
const cuts = [
  { sourceId: 'proj_a', startMs: 1000, endMs: 8000 },
  { sourceId: 'proj_b', startMs: 22000, endMs: 27000 },
  { sourceId: 'proj_a', startMs: 54000, endMs: 64000 },
]

describe('YouTube story assembly', () => {
  it('writes every cut in order with source audio, even when a source repeats', () => {
    const edits = buildYoutubeStoryEditAssembly(defaultEdits(bounds), cuts, uploads)
    expect(edits.trim).toEqual({ in: 1000, out: 8000 })
    expect(edits.sources).toHaveLength(3)
    expect(edits.inserts?.map((ins) => [ins.sourceId, ins.inMs, ins.durMs])).toEqual([
      ['yt_source_1', 22000, 5000],
      ['yt_source_2', 54000, 10000],
    ])
    expect(edits.inserts?.every((ins) => ins.audio !== 'mute')).toBe(true)
    const normalized = normalizeEdits(edits, bounds)
    expect(normalized.inserts).toHaveLength(2)
    const totalMs = normalized.trim.out - normalized.trim.in +
      (normalized.inserts?.reduce((n, insert) => n + insert.durMs, 0) ?? 0)
    expect(totalMs).toBe(22000)
  })

  it('keeps selected cross-source story order even when timestamps go backward', () => {
    const editorial = [
      { sourceId: 'proj_a', startMs: 54000, endMs: 64000, label: 'Reveal' },
      { sourceId: 'proj_b', startMs: 1000, endMs: 8000, label: 'Earlier footage' },
      { sourceId: 'proj_a', startMs: 22000, endMs: 27000, label: 'Payoff' },
    ]
    expect(storyCutsInEditorialOrder(editorial)).toEqual(editorial)
    const option = {
      id: 'story_cross_source', title: 'Story', premise: 'Cross source narrative',
      beats: editorial.map(cut => ({ ...cut, evidence: cut.label })),
    }
    const story = resultStoryFields(option, editorial)
    expect(story.chapters.map(chapter => [chapter.title, chapter.startMs])).toEqual([
      ['Reveal', 0], ['Earlier footage', 10000], ['Payoff', 17000],
    ])
    expect(story.plan.beats.map(beat => beat.label)).toEqual(['Reveal', 'Earlier footage', 'Payoff'])
    expect(story.durationMs).toBe(22000)
    const edits = buildYoutubeStoryEditAssembly(
      defaultEdits({ clipStartMs: 54000, clipEndMs: 64000, trimMinMs: 0, trimMaxMs: 64000 }),
      editorial, [uploads[0]!, uploads[1]!, uploads[2]!],
    )
    expect(edits.inserts?.map(insert => insert.inMs)).toEqual([1000, 22000])
  })

  it('preserves an intentionally repeated excerpt instead of dropping it as overlap', () => {
    const repeat = [cuts[0]!, cuts[0]!]
    expect(storyCutsInEditorialOrder(repeat)).toHaveLength(2)
    const result = buildYoutubeStoryEditAssembly(defaultEdits(bounds), repeat, [uploads[0]!, uploads[2]!])
    expect(result.inserts?.map(insert => insert.inMs)).toEqual([1000])
  })

  it('does not silently clamp a source cut longer than ten minutes', () => {
    const veryLong = [
      cuts[0]!, { sourceId: 'proj_b', startMs: 0, endMs: 720000 },
    ]
    const edits = buildYoutubeStoryEditAssembly(defaultEdits(bounds), veryLong, uploads.slice(0, 2).map((u) => ({
      ...u, durationMs: 900000,
    })))
    expect(edits.inserts).toHaveLength(2)
    expect(edits.inserts?.reduce((n, ins) => n + ins.durMs, 0)).toBe(720000)
  })

  it('keeps a 100ms remainder when a cut exceeds ten minutes', () => {
    const moreThanTen = [
      cuts[0]!, { sourceId: 'proj_b', startMs: 0, endMs: 600100 },
    ]
    const edits = buildYoutubeStoryEditAssembly(defaultEdits(bounds), moreThanTen, [
      uploads[0]!, { ...uploads[1]!, durationMs: 900000 },
    ])
    expect(edits.inserts).toHaveLength(2)
    expect(edits.inserts?.reduce((n, ins) => n + ins.durMs, 0)).toBe(600100)
  })
})


describe('YT02 extended long-form normalization contract', () => {
  it('keeps 62 selected cuts, 62 sources and 61 append pieces through save and reload', () => {
    const manyCuts = Array.from({ length: 62 }, (_, i) => ({
      sourceId: `project_${i}`, startMs: 1000, endMs: 2200,
    }))
    const manyUploads = manyCuts.map((_, i) => ({
      id: `upl_${i}`, label: `Recording ${i}`, durationMs: 5000,
    }))
    const longBounds = { clipStartMs: 1000, clipEndMs: 2200, trimMinMs: 0, trimMaxMs: 5000 }
    const edits = buildYoutubeStoryEditAssembly(defaultEdits(longBounds), manyCuts, manyUploads)
    expect(edits.youtubeLongFormAssembly).toBe(1)
    expect(edits.sources).toHaveLength(62)
    expect(edits.inserts).toHaveLength(61)
    const saved = JSON.parse(JSON.stringify(normalizeEdits(edits, longBounds)))
    const reloaded = normalizeEdits(saved, longBounds)
    expect(reloaded.sources).toHaveLength(62)
    expect(reloaded.inserts).toHaveLength(61)
    expect(reloaded.inserts?.at(-1)?.sourceId).toBe('yt_source_61')
    expect(reloaded.inserts?.every(piece => piece.audio !== 'mute')).toBe(true)
    expect(reloaded.trim.out - reloaded.trim.in +
      (reloaded.inserts?.reduce((sum, piece) => sum + piece.durMs, 0) ?? 0)).toBe(62 * 1200)
  })

  it('preserves the unchanged legacy 50-source/50-insert limits without a YouTube flag', () => {
    const longBounds = { clipStartMs: 1000, clipEndMs: 2200, trimMinMs: 0, trimMaxMs: 5000 }
    const sources = Array.from({ length: 62 }, (_, i) => ({
      id: `src_${i}`, ref: 'upload' as const, refId: `upl_${i}`, mediaType: 'video' as const,
      durationMs: 5000,
    }))
    const inserts = Array.from({ length: 61 }, (_, i) => ({
      id: `ins_${i}`, sourceId: 'src_0', atSrcMs: 2200,
      append: true as const, inMs: 1000, durMs: 1200,
    }))
    const legacy = normalizeEdits({ ...defaultEdits(longBounds), sources, inserts }, longBounds)
    const truncatedBaseline = normalizeEdits({
      ...defaultEdits(longBounds), sources: sources.slice(0, 50), inserts: inserts.slice(0, 50),
    }, longBounds)
    expect(legacy.youtubeLongFormAssembly).toBeUndefined()
    expect(legacy.sources).toHaveLength(50)
    expect(legacy.inserts).toHaveLength(50)
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(truncatedBaseline))
  })
})
