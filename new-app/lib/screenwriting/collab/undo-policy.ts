/** When collab is active, ProseMirror History must be off — Yjs owns undo. */
export function shouldDisablePmHistory(collabActive: boolean): boolean {
  return collabActive
}

export function collabUndoStackLabel(collabActive: boolean): string {
  return collabActive ? 'Collaborative undo (Yjs)' : 'Local undo'
}
