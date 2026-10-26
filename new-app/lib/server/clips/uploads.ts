import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName, uploadSourceKey, type CreateUploadResult } from '@/lib/storage'
import { appendChunk, chunkBytesReceived, chunkFilePath, openChunkReadStream, removeChunkFile } from '@/lib/server/clips/app-chunk-store'
import {
  CLIPS_APP_CHUNK_BYTES,
  clipUploadMaxBytes,
  shouldUseAppChunkedUpload,
} from '@/lib/server/clips/upload-limits'
import { finalizeStagingUpload, shouldStoreUploadOnStaging } from '@/lib/server/clips/upload-staging'

export function extFromFilename(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || 'mp4'
}

export async function createClipUpload(workspaceId: string, input: { filename: string; bytes: number; mime: string }) {
  if (!input.bytes || input.bytes < 1) throw new Error('Invalid file size')
  const maxBytes = clipUploadMaxBytes()
  if (input.bytes > maxBytes) {
    throw new Error(`File exceeds maximum upload size (${Math.round(maxBytes / (1024 * 1024))} MB)`)
  }
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
  const totalBytes = Number(row.bytes)
  const useAppChunk =
    storageDriverName() === 'supabase' && shouldUseAppChunkedUpload(totalBytes)
  if (useAppChunk) {
    const received = await chunkBytesReceived(uploadId)
    if (received !== totalBytes) {
      throw new Error(`Incomplete upload (${received} of ${totalBytes} bytes received)`)
    }
    const ext = extFromFilename(row.filename)
    if (shouldStoreUploadOnStaging(totalBytes)) {
      const stagingKey = await finalizeStagingUpload(uploadId, ext, chunkFilePath(uploadId))
      await prisma.clipUpload.update({ where: { id: uploadId }, data: { key: stagingKey } })
    } else {
      const stream = await openChunkReadStream(uploadId)
      try {
        await storage.putStream(row.key, stream, row.mime)
      } finally {
        await removeChunkFile(uploadId)
      }
    }
  } else {
    await storage.completeUpload({
      objectKey: row.key,
      s3UploadId: row.s3UploadId,
      parts,
    })
  }
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
  await removeChunkFile(uploadId).catch(() => {})
  await prisma.clipUpload.update({ where: { id: uploadId }, data: { status: 'ABORTED' } })
}

export async function writeClipUploadChunk(
  workspaceId: string,
  uploadId: string,
  offset: number,
  body: Buffer,
): Promise<{ received: number }> {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId, status: 'PENDING' } })
  if (!row) throw new Error('Upload not found')
  const totalBytes = Number(row.bytes)
  if (!shouldUseAppChunkedUpload(totalBytes)) throw new Error('Chunk upload not enabled for this session')
  if (offset + body.length > totalBytes) throw new Error('Chunk exceeds declared file size')
  const received = await appendChunk(uploadId, offset, body)
  return { received }
}

export async function getClipUploadResume(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId, status: 'PENDING' } })
  if (!row) throw new Error('Upload not found or already completed')
  const totalBytes = Number(row.bytes)
  if (!shouldUseAppChunkedUpload(totalBytes)) throw new Error('Resume not supported for this upload type')
  const received = await chunkBytesReceived(uploadId)
  return {
    uploadId: row.id,
    bytes: totalBytes,
    received,
    chunkBytes: CLIPS_APP_CHUNK_BYTES,
    chunkUrl: `/api/clips/uploads/${uploadId}/chunk`,
  }
}

export async function getClipUploadProgress(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) throw new Error('Upload not found')
  const totalBytes = Number(row.bytes)
  let received = 0
  if (row.status === 'PENDING' && shouldUseAppChunkedUpload(totalBytes)) {
    received = await chunkBytesReceived(uploadId)
  } else if (row.status === 'COMPLETE') {
    received = totalBytes
  }
  return {
    uploadId: row.id,
    status: row.status,
    bytes: totalBytes,
    received,
    filename: row.filename,
    canResume: row.status === 'PENDING' && shouldUseAppChunkedUpload(totalBytes),
  }
}
