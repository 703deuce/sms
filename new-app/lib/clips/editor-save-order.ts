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

/** TC4fix2: pagehide must always queue a keepalive when local revision is ahead of last ack. */
export function shouldSendPagehideKeepalive(savedRevision: number, localRevision: number): boolean {
  return saveSyncRequired(savedRevision, localRevision)
}

/** TC4fix2: stale server stamp must not discard a newer in-flight draft snapshot. */
export function shouldDiscardDraftForServerStamp(
  draftServerUpdatedAt: string | undefined,
  serverUpdatedAt: string | undefined,
  draftLocalRevision: number | undefined,
  draftDiffersFromServer: boolean,
): boolean {
  if (!draftDiffersFromServer) return false
  if (!draftServerUpdatedAt || !serverUpdatedAt) return false
  if (draftServerUpdatedAt === serverUpdatedAt) return false
  return (draftLocalRevision ?? 0) <= 0
}

/** TC4fix2: server-side — reject applying edits when a newer client save seq already landed. */
export function shouldRejectStaleClientSave(incomingSeq: number, storedSeq: number): boolean {
  return incomingSeq > 0 && storedSeq > 0 && incomingSeq < storedSeq
}

export function nextStoredClientSaveSeq(incomingSeq: number, storedSeq: number): number {
  if (incomingSeq <= 0) return storedSeq
  return Math.max(storedSeq, incomingSeq)
}
