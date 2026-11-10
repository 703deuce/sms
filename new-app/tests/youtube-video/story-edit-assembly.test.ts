import { describe, expect, it } from 'vitest'
import { defaultEdits, normalizeEdits } from '@/lib/clips/edits'
import { buildYoutubeStoryEditAssembly } from '@/lib/youtube-video/story-edit-assembly'

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
})
