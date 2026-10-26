import * as Y from 'yjs'

/** Group rapid keystrokes into one undo step (Final Draft–style). */
export const YJS_UNDO_CAPTURE_MS = 450

export function createScreenplayUndoManager(ydoc: Y.Doc, field = 'prosemirror'): Y.UndoManager {
  const fragment = ydoc.getXmlFragment(field)
  return new Y.UndoManager(fragment, {
    captureTimeout: YJS_UNDO_CAPTURE_MS,
  })
}
