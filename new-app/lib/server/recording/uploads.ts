import 'server-only'
import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName } from '@/lib/storage'
import {
  bytesReceivedFromParts,
  type UploadPartRecord,
} from '@/lib/server/clips/upload-part-bookkeeping'
import { s3PartSizeBytes } from '@/lib/server/clips/upload-s3-resume'

function recordingTrackObjectKey(workspaceId: string, sessionId: string, trackId: string, ext: string) {
  return `clips/${workspaceId}/recording/${sessionId}/${trackId}.${ext}`
}

function extFromMime(mime: string) {
  if (mime.includes('webm')) return 'webm'
  if (mime.includes('mp4')) return 'mp4'
  return 'bin'
}

export async function beginRecordingTrackUpload(input: {
  workspaceId: string
  sessionId: string
  trackId: string
  bytesExpected: number
  mimeType: string
}) {
  const prisma = getPrisma()
  const track = await prisma.recordingTrack.findFirst({
    where: { id: input.trackId },
    include: { take: { include: { session: true } }, participant: true },
  })
  if (!track || track.take.sessionId !== input.sessionId) throw new Error('Track not found')
  if (track.take.session.workspaceId !== input.workspaceId) throw new Error('Track not found')

  const driver = storageDriverName()
  const storage = getClipStorage(driver)
  const ext = extFromMime(input.mimeType)
  const key = recordingTrackObjectKey(input.workspaceId, input.sessionId, input.trackId, ext)
  const session = await storage.createUpload({
    workspaceId: input.workspaceId,
    uploadId: input.trackId,
    filename: `${input.trackId}.${ext}`,
    bytes: input.bytesExpected,
    mime: input.mimeType,
    objectKey: key,
  })

  await prisma.recordingTrack.update({
    where: { id: input.trackId },
    data: {
      storageKey: key,
      s3UploadId: session.s3Multipart?.uploadId ?? null,
      bytesExpected: BigInt(input.bytesExpected),
      status: 'UPLOADING',
    },
  })

  return { trackId: input.trackId, storageKey: key, storage }
}

async function listTrackParts(trackId: string): Promise<UploadPartRecord[]> {
  const prisma = getPrisma()
  const rows = await prisma.recordingTrackUploadPart.findMany({
    where: { trackId },
    orderBy: { partNumber: 'asc' },
  })
  return rows.map((r) => ({ partNumber: r.partNumber, etag: r.etag, sizeBytes: r.sizeBytes }))
}

export async function recordRecordingTrackPart(
  workspaceId: string,
  trackId: string,
  partNumber: number,
  etag: string,
  sizeBytes?: number,
  chunkSeq?: { from: number; to: number },
) {
  const prisma = getPrisma()
  const track = await prisma.recordingTrack.findFirst({
    where: { id: trackId },
    include: { take: { include: { session: true } } },
  })
  if (!track || track.take.session.workspaceId !== workspaceId) throw new Error('Track not found')
  if (!track.s3UploadId) throw new Error('Multipart upload not started')

  await prisma.recordingTrackUploadPart.upsert({
    where: { trackId_partNumber: { trackId, partNumber } },
    create: {
      id: createId('rtup'),
      trackId,
      partNumber,
      etag,
      sizeBytes: sizeBytes ?? null,
      chunkSeqFrom: chunkSeq?.from ?? null,
      chunkSeqTo: chunkSeq?.to ?? null,
    },
    update: {
      etag,
      sizeBytes: sizeBytes ?? null,
      chunkSeqFrom: chunkSeq?.from ?? null,
      chunkSeqTo: chunkSeq?.to ?? null,
    },
  })

  const parts = await listTrackParts(trackId)
  const expected = track.bytesExpected ? Number(track.bytesExpected) : 0
  const received = bytesReceivedFromParts(parts, s3PartSizeBytes(), expected)
  return { received, parts }
}

export async function completeRecordingTrackUpload(workspaceId: string, trackId: string) {
  const prisma = getPrisma()
  const track = await prisma.recordingTrack.findFirst({
    where: { id: trackId },
    include: { take: { include: { session: true } }, uploadParts: true },
  })
  if (!track || track.take.session.workspaceId !== workspaceId) throw new Error('Track not found')
  if (!track.storageKey || !track.s3UploadId) throw new Error('Upload not initialized')

  const driver = storageDriverName()
  const storage = getClipStorage(driver)
  const parts = track.uploadParts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => ({ partNumber: p.partNumber, etag: p.etag }))

  await storage.completeUpload({
    objectKey: track.storageKey,
    s3UploadId: track.s3UploadId,
    parts,
  })

  await prisma.recordingTrack.update({
    where: { id: trackId },
    data: { status: 'UPLOADED' },
  })

  return { trackId, storageKey: track.storageKey }
}

export async function registerRecordingTrack(input: {
  workspaceId: string
  sessionId: string
  takeId: string
  participantId: string
  trackId?: string
  kind: 'CAMERA' | 'MICROPHONE' | 'SCREEN' | 'SCREEN_AUDIO'
  mimeType: string
  sampleRate?: number
  actualStartHostMs?: number
  segmentIndex?: number
}) {
  const prisma = getPrisma()
  const take = await prisma.recordingTake.findFirst({
    where: { id: input.takeId, sessionId: input.sessionId },
    include: { session: true },
  })
  if (!take || take.session.workspaceId !== input.workspaceId) throw new Error('Take not found')

  const participant = await prisma.recordingParticipant.findFirst({
    where: { id: input.participantId, sessionId: input.sessionId },
  })
  if (!participant) throw new Error('Participant not found')

  const id = input.trackId ?? createId('rtrk')
  return prisma.recordingTrack.create({
    data: {
      id,
      takeId: input.takeId,
      participantId: input.participantId,
      kind: input.kind,
      mimeType: input.mimeType,
      sampleRate: input.sampleRate ?? null,
      actualStartHostMs: input.actualStartHostMs != null ? BigInt(input.actualStartHostMs) : null,
      segmentIndex: input.segmentIndex ?? 0,
      status: 'RECORDING',
    },
  })
}
