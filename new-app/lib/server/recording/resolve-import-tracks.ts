import 'server-only'
import type { RecordingTrack, RecordingTrackKind } from '@prisma/client'

type TrackRow = RecordingTrack & { participant?: { displayName: string; role?: string } }

function key(p: string, k: RecordingTrackKind) {
  return `${p}:${k}`
}

/** Prefer HQ browser upload; fall back to cloud backup egress per participant/kind. */
export function resolveTracksForImport(
  tracks: TrackRow[],
  opts: { preferCloudBackup?: boolean } = {},
): TrackRow[] {
  const byKey = new Map<string, TrackRow[]>()
  for (const t of tracks) {
    const k = key(t.participantId, t.kind)
    const list = byKey.get(k) ?? []
    list.push(t)
    byKey.set(k, list)
  }
  const picked: TrackRow[] = []
  for (const [, list] of byKey) {
    const hq = list.find((t) => t.qualitySource === 'HIGH_QUALITY' && t.status === 'UPLOADED' && t.storageKey)
    const backup = list.find((t) => t.qualitySource === 'BACKUP' && t.status === 'UPLOADED' && t.storageKey)
    if (opts.preferCloudBackup && backup) {
      picked.push(backup)
      continue
    }
    if (hq) picked.push(hq)
    else if (backup) picked.push(backup)
  }
  return picked
}
