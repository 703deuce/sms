import { describe, expect, it } from 'vitest'
import { persistEditorSave } from '@/lib/server/clips/persist-editor-save'
import type { ClipBounds } from '@/lib/clips/edits'

const bounds: ClipBounds = { clipStartMs: 0, clipEndMs: 60_000 }

function fakeDb(row: {
  id: string
  title: string
  edits: { videoSplits: number[] }
  aiMeta: { __editorSaveSeq: number }
  editsSaveVersion: number
  updatedAt: Date
}) {
  const full = {
    ...row,
    updatedAt: row.updatedAt ?? new Date(),
    title: row.title ?? 't',
  }
  return {
    row: full,
    clip: {
      findUnique: async () => structuredClone(full),
      updateMany: async ({ where, data }: { where: { editsSaveVersion: number }; data: { edits: unknown; aiMeta: unknown } }) => {
        if (where.editsSaveVersion !== full.editsSaveVersion) return { count: 0 }
        Object.assign(full, {
          edits: data.edits,
          aiMeta: data.aiMeta,
          editsSaveVersion: full.editsSaveVersion + 1,
        })
        return { count: 1 }
      },
    },
  }
}

describe('TC4fix3 R1 stale save cannot win', () => {
  it('older seq written after newer seq is rejected (both read before either writes)', async () => {
    const db = fakeDb({
      id: 'c',
      title: 't',
      edits: { videoSplits: [] },
      aiMeta: { __editorSaveSeq: 5 },
      editsSaveVersion: 3,
      updatedAt: new Date(),
    })
    const staleRead = structuredClone(db.row)
    await persistEditorSave(db as never, 'c', {
      editsPatch: { videoSplits: [1000] },
      clientSaveSeq: 7,
    }, bounds)
    await persistEditorSave(
      db as never,
      'c',
      {
        editsPatch: { videoSplits: [1000, 2000, 3000] },
        clientSaveSeq: 6,
        preRead: staleRead,
      },
      bounds,
    )
    expect(db.row.edits.videoSplits).toEqual([1000])
    expect(db.row.aiMeta.__editorSaveSeq).toBe(7)
  })
})
