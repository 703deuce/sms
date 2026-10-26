/** Screenplay editor always uses a single Yjs UndoManager — never PM History. */
export function shouldDisablePmHistory(_collabActive?: boolean): boolean {
  return true
}

export function collabUndoStackLabel(liveCollab: boolean): string {
  return liveCollab ? 'Collaborative undo (Yjs)' : 'Yjs undo (local)'
}
