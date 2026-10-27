import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { getActiveMultipartS3Config } from '@/lib/storage/multipart-config'
import { getS3Client, presignUploadPartUrl } from '@/lib/storage/s3'

export async function presignRecordingTrackPart(workspaceId: string, trackId: string, partNumber: number) {
  const prisma = getPrisma()
  const track = await prisma.recordingTrack.findFirst({
    where: { id: trackId },
    include: { take: { include: { session: true } } },
  })
  if (!track || track.take.session.workspaceId !== workspaceId) throw new Error('Track not found')
  if (!track.storageKey || !track.s3UploadId) throw new Error('Upload not initialized')
  const cfg = getActiveMultipartS3Config()
  if (!cfg) throw new Error('S3 not configured')
  const url = await presignUploadPartUrl(
    getS3Client(cfg),
    cfg.bucket,
    track.storageKey,
    track.s3UploadId,
    partNumber,
  )
  return { partNumber, url }
}
