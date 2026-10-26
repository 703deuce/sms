import type { SaveReconcileInput } from '@/lib/screenwriting/persistence/save-reconcile'

/** Only recover a device draft when it is newer than server and content actually differs. */
export function shouldRecoverLocalDraft(input: SaveReconcileInput): boolean {
  if (input.deviceHash === input.serverHash) return false
  if (input.deviceUpdatedAt <= input.serverUpdatedAt) return false
  return true
}

export function offlineDraftKeys(scriptId: string) {
  return {
    doc: `sw:offline:${scriptId}`,
    updatedAt: `sw:offline-at:${scriptId}`,
    syncedHash: `sw:synced-hash:${scriptId}`,
  }
}
