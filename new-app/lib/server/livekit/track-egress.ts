import 'server-only'
import { DirectFileOutput, S3Upload } from 'livekit-server-sdk'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { getLiveKitApi } from '@/lib/server/livekit/client'
import { roomNameForSession } from '@/lib/server/livekit/rooms'
import { getActiveMultipartS3Config } from '@/lib/storage/multipart-config'
import { recordingTrackObjectKey } from '@/lib/server/recording/track-keys'

function s3UploadFromConfig(): S3Upload {
  const cfg = getActiveMultipartS3Config()
  if (!cfg) throw new Error('S3 not configured for egress')
  const internal = process.env.S3_ENDPOINT?.trim() || cfg.endpoint
  return new S3Upload({
    accessKey: cfg.accessKeyId,
    secret: cfg.secretAccessKey,
    bucket: cfg.bucket,
    region: cfg.region,
    endpoint: internal,
    forcePathStyle: cfg.forcePathStyle ?? true,
  })
}

function extForTrackKind(kind: string) {
  if (kind === 'MICROPHONE' || kind === 'SCREEN_AUDIO') return 'ogg'
  return 'mp4'
}

/** Start LiveKit TrackEgress to B2 for each published track (cloud backup). */
export async function startCloudBackupEgressForTake(
  workspaceId: string,
  sessionId: string,
  takeId: string,
) {
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, workspaceId, kind: 'ROOM' },
  })
  if (!session?.cloudBackupEnabled) return { started: 0 }

  const cfg = getActiveMultipartS3Config()
  if (!cfg) return { started: 0 }

  const lk = getLiveKitApi()
  const room = roomNameForSession(sessionId)
  const participants = await lk.room.listParticipants(room)
  let started = 0

  for (const p of participants) {
    for (const pub of p.tracks) {
      if (!pub.sid || pub.muted) continue
      const src = Number(pub.source)
      const kind =
        src === 2
          ? 'MICROPHONE'
          : src === 1
            ? 'CAMERA'
            : src === 3
              ? 'SCREEN'
              : src === 4
                ? 'SCREEN_AUDIO'
                : null
      if (!kind) continue

      const existing = await prisma.recordingTrack.findFirst({
        where: { takeId, livekitTrackSid: pub.sid, qualitySource: 'BACKUP' },
      })
      if (existing) continue

      const trackId = createId('rtrk')
      const ext = extForTrackKind(kind)
      const key = recordingTrackObjectKey(workspaceId, sessionId, trackId, ext)
      const output = new DirectFileOutput({
        filepath: key,
        output: { case: 's3', value: s3UploadFromConfig() },
      })

      const info = await lk.egress.startTrackEgress(room, output, pub.sid)
      const egressId = info.egressId

      await prisma.recordingTrack.create({
        data: {
          id: trackId,
          takeId,
          participantId: p.identity,
          kind,
          qualitySource: 'BACKUP',
          mimeType: kind === 'MICROPHONE' ? 'audio/ogg' : 'video/mp4',
          status: 'RECORDING',
          storageKey: key,
          livekitEgressId: egressId,
          livekitTrackSid: pub.sid,
        },
      })
      started += 1
    }
  }
  return { started }
}

/** Start backup egress when a track is published mid-take (after countdown). */
export async function maybeStartBackupEgressForPublishedTrack(
  sessionId: string,
  participantIdentity: string,
  track: { sid?: string; source?: number | string; muted?: boolean },
) {
  if (!track.sid || track.muted) return
  const prisma = getPrisma()
  const session = await prisma.recordingSession.findFirst({
    where: { id: sessionId, kind: 'ROOM', cloudBackupEnabled: true },
    include: {
      takes: { orderBy: { index: 'desc' }, take: 1, include: { tracks: { where: { livekitTrackSid: track.sid } } } },
    },
  })
  if (!session?.takes[0] || session.takes[0].stopAtHostMs) return
  if (session.takes[0].tracks.length) return
  const takeId = session.takes[0].id
  const workspaceId = session.workspaceId
  await startCloudBackupEgressForTake(workspaceId, sessionId, takeId)
}

export async function stopCloudBackupEgressForTake(sessionId: string, takeId: string) {
  const prisma = getPrisma()
  const rows = await prisma.recordingTrack.findMany({
    where: { takeId, qualitySource: 'BACKUP', livekitEgressId: { not: null } },
    select: { livekitEgressId: true },
  })
  if (!rows.length) return
  const lk = getLiveKitApi()
  for (const row of rows) {
    if (!row.livekitEgressId) continue
    try {
      await lk.egress.stopEgress(row.livekitEgressId)
    } catch {
      /* may already be complete */
    }
  }
}
