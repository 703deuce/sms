import 'server-only'
import { getLiveKitApi } from '@/lib/server/livekit/client'
import type { RecordingRoomMetadataV1 } from '@/lib/recording/rec-control'

export function roomNameForSession(sessionId: string): string {
  return `rec_${sessionId}`
}

export async function ensureRecordingRoom(sessionId: string, maxParticipants: number) {
  const lk = getLiveKitApi()
  const name = roomNameForSession(sessionId)
  return lk.room.createRoom({
    name,
    emptyTimeout: 30 * 60,
    departureTimeout: 120,
    maxParticipants,
    metadata: JSON.stringify({ v: 1, recState: 'idle' }),
  })
}

export async function deleteRecordingRoom(sessionId: string) {
  const lk = getLiveKitApi()
  await lk.room.deleteRoom(roomNameForSession(sessionId))
}

export async function removeParticipant(sessionId: string, identity: string) {
  const lk = getLiveKitApi()
  await lk.room.removeParticipant(roomNameForSession(sessionId), identity)
}

export async function setRecordingRoomMetadata(sessionId: string, metadata: RecordingRoomMetadataV1) {
  const lk = getLiveKitApi()
  await lk.room.updateRoomMetadata(roomNameForSession(sessionId), JSON.stringify(metadata))
}
