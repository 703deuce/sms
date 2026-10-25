import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getS3Client,
  getS3Config,
  presignUploadPartUrl,
  uploadSourceKey,
} from '@/lib/storage/s3'

const PART_SIZE = 10 * 1024 * 1024
const MAX_PARTS = 10_000

export function extFromFilename(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || 'mp4'
}

export async function createClipUpload(workspaceId: string, input: { filename: string; bytes: number; mime: string }) {
  const cfg = getS3Config()
  if (!cfg) throw new Error('Object storage is not configured')
  const uploadId = createId('upl')
  const ext = extFromFilename(input.filename)
  const key = uploadSourceKey(workspaceId, uploadId, ext)
  const client = getS3Client(cfg)
  const s3UploadId = await createMultipartUpload(client, cfg.bucket, key, input.mime)
  const partCount = Math.min(MAX_PARTS, Math.max(1, Math.ceil(input.bytes / PART_SIZE)))
  const partUrls: { partNumber: number; url: string }[] = []
  for (let partNumber = 1; partNumber <= partCount; partNumber++) {
    partUrls.push({
      partNumber,
      url: await presignUploadPartUrl(client, cfg.bucket, key, s3UploadId, partNumber),
    })
  }
  const prisma = getPrisma()
  await prisma.clipUpload.create({
    data: {
      id: uploadId,
      workspaceId,
      key,
      filename: input.filename,
      bytes: BigInt(input.bytes),
      mime: input.mime,
      status: 'PENDING',
      s3UploadId,
    },
  })
  return { uploadId, key, partSize: PART_SIZE, partUrls }
}

export async function completeClipUpload(
  workspaceId: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
  meta?: { durationMs?: number; width?: number; height?: number },
) {
  const cfg = getS3Config()
  if (!cfg) throw new Error('Object storage is not configured')
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row || !row.s3UploadId) throw new Error('Upload not found')
  const client = getS3Client(cfg)
  await completeMultipartUpload(client, cfg.bucket, row.key, row.s3UploadId, parts)
  await prisma.clipUpload.update({
    where: { id: uploadId },
    data: {
      status: 'COMPLETE',
      durationMs: meta?.durationMs,
      width: meta?.width,
      height: meta?.height,
    },
  })
  return row
}

export async function abortClipUpload(workspaceId: string, uploadId: string) {
  const cfg = getS3Config()
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) return
  if (cfg && row.s3UploadId) {
    await abortMultipartUpload(getS3Client(cfg), cfg.bucket, row.key, row.s3UploadId)
  }
  await prisma.clipUpload.update({ where: { id: uploadId }, data: { status: 'ABORTED' } })
}

export { PART_SIZE }
