import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { createScreenplayUndoManager, YJS_UNDO_CAPTURE_MS } from '@/lib/screenwriting/collab/yjs-undo'
import { shouldDisablePmHistory } from '@/lib/screenwriting/collab/undo-policy'
import { shouldRecoverLocalDraft } from '@/lib/screenwriting/persistence/offline-draft'

describe('P0 Yjs undo', () => {
  it('[U] disables ProseMirror history for screenplay', () => {
    expect(shouldDisablePmHistory(false)).toBe(true)
    expect(shouldDisablePmHistory(true)).toBe(true)
  })

  it('[U] UndoManager groups capture window', () => {
    const doc = new Y.Doc()
    const um = createScreenplayUndoManager(doc)
    expect(um.captureTimeout).toBe(YJS_UNDO_CAPTURE_MS)
    um.destroy()
    doc.destroy()
  })

  it('[U] does not recover local draft when hashes match server', () => {
    expect(
      shouldRecoverLocalDraft({
        deviceUpdatedAt: Date.now() + 1000,
        serverUpdatedAt: Date.now(),
        deviceHash: '1:1',
        serverHash: '1:1',
      }),
    ).toBe(false)
  })

  it('[U] recovers only when local is newer and differs', () => {
    expect(
      shouldRecoverLocalDraft({
        deviceUpdatedAt: 200,
        serverUpdatedAt: 100,
        deviceHash: 'a',
        serverHash: 'b',
      }),
    ).toBe(true)
  })
})
