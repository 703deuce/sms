/** Whether an in-flight PATCH response may advance saved bookkeeping (TC4fix ordering). */
export function shouldApplySaveResponse(
  saveSeqAtSend: number,
  latestSaveSeq: number,
  revisionAtSend: number,
  localRevision: number,
): boolean {
  return saveSeqAtSend === latestSaveSeq && revisionAtSend === localRevision
}

/** True while local edits may still differ from what the server last acknowledged. */
export function saveSyncRequired(savedRevision: number, localRevision: number): boolean {
  return savedRevision < localRevision
}

/**
 * Undo can return edits to the same JSON as `lastSavedEdits` while `localRevision` is ahead
 * (each undo bumps revision) and a stale PATCH may still be in flight — never skip sync then.
 */
export function wouldFalsePositiveSavedSync(
  editsCanonical: string,
  lastSavedEditsCanonical: string,
  savedRevision: number,
  localRevision: number,
): boolean {
  return savedRevision < localRevision && editsCanonical === lastSavedEditsCanonical
}
