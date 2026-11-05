import { describe, expect, it } from 'vitest'
import { defaultEdits, editsPayloadForSave, mergeEditsPatch, normalizeEdits } from '@/lib/clips/edits'
import { insertCopiedMainVideo } from '@/lib/clips/editor/timeline-edit-ops'
import { describeEditsChange } from '@/lib/clips/editor/history-labels'
const bounds = { clipStartMs: 0, clipEndMs: 22000, trimMinMs: 0, trimMaxMs: 22000 }
const original = () => normalizeEdits(defaultEdits(bounds), bounds)

describe('Retest #8 F38 Duplicate/Paste Undo persistence', () => {
  for (const action of ['Duplicate', 'Paste'] as const) {
    it(`${action} then Undo restores original sectionOrder on server reload`, () => {
      const initial = original()
      const withCopy = insertCopiedMainVideo(initial, action === 'Duplicate' ? 22000 : 6000, [{srcInMs:0,srcOutMs:22000}])
      expect(withCopy?.sectionOrder?.length).toBeGreaterThan(1)
      // First accepted PATCH: the duplicated EDL exists on the server.
      const persistedCopy = mergeEditsPatch(initial, editsPayloadForSave(withCopy!), bounds)
      expect(persistedCopy.sectionOrder?.length).toBeGreaterThan(1)
      // Undo restores the original state, whose optional sectionOrder is absent.
      const undoPayload = editsPayloadForSave(initial)
      expect(undoPayload.sectionOrder).toBeNull()
      const persistedUndo = mergeEditsPatch(persistedCopy, undoPayload, bounds)
      const reload = normalizeEdits(persistedUndo, bounds)
      expect(reload.sectionOrder).toBeUndefined()
      expect(reload.trim).toEqual(initial.trim)
      expect(describeEditsChange(initial, withCopy!)).not.toBe('Original clip')
    })
  }

  it('does not clear intentionally reordered or repeated EDL sections', () => {
    const copy = insertCopiedMainVideo(original(), 22000, [{srcInMs:0,srcOutMs:22000}])!
    expect(editsPayloadForSave(copy).sectionOrder).toEqual(copy.sectionOrder)
  })
})
