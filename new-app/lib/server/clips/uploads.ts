import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, uploadSourceKey, type CreateUploadResult } from '@/lib/storage'

export function extFromFilename(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || 'mp4'
}

export async function createClipUpload(workspaceId: string, input: { filename: string; bytes: number; mime: string }) {
  if (!input.bytes || input.bytes < 1) throw new Error('Invalid file size')
  const storage = getClipStorage()
  const uploadId = createId('upl')
  const ext = extFromFilename(input.filename)
  const key = uploadSourceKey(workspaceId, uploadId, ext)
  const session: CreateUploadResult = await storage.createUpload({
    workspaceId,
    uploadId,
    filename: input.filename,
    bytes: input.bytes,
    mime: input.mime,
    objectKey: key,
  })
  const s3UploadId = session.s3Multipart?.uploadId ?? null
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
  return {
    uploadId,
    key,
    storage: session,
  }
}

export async function completeClipUpload(
  workspaceId: string,
  uploadId: string,
  parts?: { partNumber: number; etag: string }[],
  meta?: { durationMs?: number; width?: number; height?: number },
) {
  const storage = getClipStorage()
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) throw new Error('Upload not found')
  await storage.completeUpload({
    objectKey: row.key,
    s3UploadId: row.s3UploadId,
    parts,
  })
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
  const storage = getClipStorage()
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) return
  await storage.abortUpload({ objectKey: row.key, s3UploadId: row.s3UploadId }).catch(() => {})
  await prisma.clipUpload.update({ where: { id: uploadId }, data: { status: 'ABORTED' } })
}
