export const AUTO_SNAPSHOT_INTERVAL_MS = 30 * 60 * 1000

export type SnapshotTrigger = 'auto' | 'manual' | 'import' | 'lock' | 'production_draft' | 'pre_restore'

export function shouldAutoSnapshot(lastActiveAt: number, now: number): boolean {
  return now - lastActiveAt >= AUTO_SNAPSHOT_INTERVAL_MS
}
