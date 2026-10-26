export type SaveSource = 'device' | 'server'

export interface SaveReconcileInput {
  deviceUpdatedAt: number
  serverUpdatedAt: number
  deviceHash: string
  serverHash: string
}

/** Prefer newer timestamp; tie-break server when hashes differ. */
export function reconcileSave(input: SaveReconcileInput): SaveSource {
  if (input.deviceHash === input.serverHash) return 'server'
  if (input.deviceUpdatedAt > input.serverUpdatedAt) return 'device'
  return 'server'
}

export function mergeOfflineRecovery<T>(local: T | null, server: T): T {
  return local ?? server
}

export function hashPmJson(doc: unknown): string {
  const s = JSON.stringify(doc)
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}
