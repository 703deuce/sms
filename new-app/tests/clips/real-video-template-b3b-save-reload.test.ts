import { beforeEach, describe, expect, it, vi } from 'vitest'

const { row, db } = vi.hoisted(() => {
  const row: Record<string, any> = {
    id: 'clip_b3b',
    edits: null,
    editsSaveVersion: 0,
    updatedAt: new Date('2026-11-11T12:00:00.000Z'),
  }
  const clip = {
    findUniqueOrThrow: vi.fn(async ({ where }: any) => {
      if (where.id !== row.id) throw new Error('missing clip')
      return row
    }),
    updateMany: vi.fn(async ({ where, data }: any) => {
      if (where.id !== row.id || where.editsSaveVersion !== row.editsSaveVersion) return { count: 0 }
      row.edits = structuredClone(data.edits)
      if (data.editsSaveVersion?.increment) row.editsSaveVersion += data.editsSaveVersion.increment
      row.updatedAt = new Date(row.updatedAt.getTime() + 1000)
      return { count: 1 }
    }),
  }
  return { row, db: { clip } as any }
})

vi.mock('server-only', () => ({}))
vi.mock('@/lib/server/db', () => ({ getPrisma: () => db }))

import { normalizeEdits } from '@/lib/clips/edits'
import { moveSourceSegmentBoundary, patchSourceSegment } from '@/lib/clips/editor/sources'
import { buildEditableTimelineProofCases } from '@/lib/clips/real-video-templates/editable-timeline-proof-cases'
import { snapshotEditableTimelineStructure } from '@/lib/clips/real-video-templates/editable-timeline-proof'
import { writeClipEdits } from '@/lib/server/clips/write-clip-edits'

const bounds = { clipStartMs: 0, clipEndMs: 3000, trimMinMs: 0, trimMaxMs: 3000 }

beforeEach(() => {
  const compiled = buildEditableTimelineProofCases()[1]!.compiled.edits
  row.edits = structuredClone(compiled)
  row.editsSaveVersion = 0
  row.updatedAt = new Date('2026-11-11T12:00:00.000Z')
  vi.clearAllMocks()
})

describe('Batch 3B production save/reload', () => {
  it('flushes template clip edits through the ordinary CAS writer and reloads every authoritative object', async () => {
    const initial = normalizeEdits(row.edits, bounds)
    const ids = initial.sourceSegments!.map((seg) => seg.id)
    let edited = moveSourceSegmentBoundary(initial, ids[0]!, ids[1]!, 1033)
    edited = {
      ...edited,
      sourceSegments: patchSourceSegment(
        edited.sourceSegments,
        ids[1]!,
        { fx: { contrast: 17 }, transform: { x: 5, scale: 111 } },
        edited.sources,
      ),
      captionLines: [{ id: 'caption_all', text: 'Saved through every slot', startMs: 0, endMs: 3000 }],
    }

    const expected = snapshotEditableTimelineStructure(normalizeEdits(edited, bounds))
    const saved = await writeClipEdits('clip_b3b', bounds, 0, () => edited)
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error('unexpected save conflict')
    expect(saved.editsSaveVersion).toBe(1)
    expect(row.editsSaveVersion).toBe(1)
    expect(snapshotEditableTimelineStructure(saved.edits)).toEqual(expected)

    const reloaded = normalizeEdits(structuredClone(row.edits), bounds)
    expect(snapshotEditableTimelineStructure(reloaded)).toEqual(expected)
    expect(reloaded.sourceSegments?.map((seg) => seg.id)).toEqual(ids)
    expect(reloaded.sourceSegments?.[1]).toMatchObject({
      id: ids[1],
      startMs: 1033,
      fx: { contrast: 17 },
      transform: { x: 5, scale: 111 },
    })
    expect(reloaded.captionLines).toEqual([
      { id: 'caption_all', text: 'Saved through every slot', startMs: 0, endMs: 3000 },
    ])
  })

  it('returns the normal optimistic conflict shape when the version is stale', async () => {
    row.editsSaveVersion = 2
    const result = await writeClipEdits('clip_b3b', bounds, 1, (edits) => edits)
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('expected conflict')
    expect(result.conflict).toBe(true)
    expect(result.editsSaveVersion).toBe(2)
  })
})
