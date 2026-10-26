import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage, storageDriverName, uploadSourceKey, type CreateUploadResult } from '@/lib/storage'
import { clipUploadEffectiveMaxBytes, formatClipUploadMaxLabel } from '@/lib/server/clips/upload-limits'
import { getSupabaseStorageConfig } from '@/lib/storage/supabase-driver'
import { SIGNED_PUT_MAX_BYTES } from '@/lib/storage/supabase-driver'
import {
  bytesReceivedFromParts,
  mergePartRecords,
  type UploadPartRecord,
} from '@/lib/server/clips/upload-part-bookkeeping'
import { buildS3MultipartResumeSession, s3PartSizeBytes } from '@/lib/server/clips/upload-s3-resume'

export function extFromFilename(name: string) {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/)
  return m?.[1] || 'mp4'
}

export async function createClipUpload(workspaceId: string, input: { filename: string; bytes: number; mime: string }) {
  if (!input.bytes || input.bytes < 1) throw new Error('Invalid file size')
  const maxBytes = clipUploadEffectiveMaxBytes()
  if (input.bytes > maxBytes) {
    throw new Error(`File exceeds maximum upload size (${formatClipUploadMaxLabel(maxBytes)})`)
  }
  const driver = storageDriverName()
  const storage = getClipStorage(driver)
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
      uploadMode: session.mode,
      storageDriver: driver,
    },
  })
  return {
    uploadId,
    key,
    storage: session,
  }
}

async function listUploadParts(uploadId: string): Promise<UploadPartRecord[]> {
  const prisma = getPrisma()
  const rows = await prisma.clipUploadPart.findMany({
    where: { uploadId },
    orderBy: { partNumber: 'asc' },
  })
  return rows.map((r) => ({ partNumber: r.partNumber, etag: r.etag, sizeBytes: r.sizeBytes }))
}

export async function recordClipUploadPart(
  workspaceId: string,
  uploadId: string,
  partNumber: number,
  etag: string,
  sizeBytes?: number,
) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId, status: 'PENDING' } })
  if (!row) throw new Error('Upload not found')
  if (!row.s3UploadId) throw new Error('Part recording only applies to S3 multipart uploads')
  await prisma.clipUploadPart.upsert({
    where: { uploadId_partNumber: { uploadId, partNumber } },
    create: { uploadId, partNumber, etag, sizeBytes: sizeBytes ?? null },
    update: { etag, sizeBytes: sizeBytes ?? null },
  })
  const parts = await listUploadParts(uploadId)
  const received = bytesReceivedFromParts(parts, s3PartSizeBytes(), Number(row.bytes))
  return { received, parts }
}

export async function completeClipUpload(
  workspaceId: string,
  uploadId: string,
  parts?: { partNumber: number; etag: string }[],
  meta?: { durationMs?: number; width?: number; height?: number },
) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) throw new Error('Upload not found')
  const storage = getClipStorage(row.storageDriver)
  if (row.status === 'COMPLETE') {
    return row
  }
  const totalBytes = Number(row.bytes)

  const existingSize = await storage.getObjectSizeBytes(row.key)
  if (existingSize !== null && existingSize === totalBytes) {
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

  if (row.uploadMode === 's3_multipart' || row.s3UploadId) {
    const dbParts = await listUploadParts(uploadId)
    const merged = parts?.length
      ? parts.reduce((acc, p) => mergePartRecords(acc, p), dbParts)
      : dbParts
    if (!merged.length) {
      throw new Error('No upload parts recorded — retry upload to resume')
    }
    const received = bytesReceivedFromParts(merged, s3PartSizeBytes(), totalBytes)
    if (received < totalBytes) {
      throw new Error(`Incomplete upload (${received} of ${totalBytes} bytes in storage)`)
    }
    await storage.completeUpload({
      objectKey: row.key,
      s3UploadId: row.s3UploadId,
      parts: merged.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    })
  } else {
    await storage.completeUpload({ objectKey: row.key, s3UploadId: row.s3UploadId })
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
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) return
  const storage = getClipStorage(row.storageDriver)
  await storage.abortUpload({ objectKey: row.key, s3UploadId: row.s3UploadId }).catch(() => {})
  await prisma.clipUploadPart.deleteMany({ where: { uploadId } })
  await prisma.clipUpload.update({ where: { id: uploadId }, data: { status: 'ABORTED' } })
}

export async function getClipUploadResume(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId, status: 'PENDING' } })
  if (!row) throw new Error('Upload not found or already completed')
  const totalBytes = Number(row.bytes)
  const storage = getClipStorage(row.storageDriver)

  if (row.uploadMode === 's3_multipart' && row.s3UploadId) {
    const parts = await listUploadParts(uploadId)
    const received = bytesReceivedFromParts(parts, s3PartSizeBytes(), totalBytes)
    const s3Multipart = await buildS3MultipartResumeSession(row.key, row.s3UploadId, totalBytes, parts)
    return {
      uploadId: row.id,
      bytes: totalBytes,
      received,
      filename: row.filename,
      storage: { mode: 's3_multipart' as const, s3Multipart },
      completedParts: parts.map((p) => ({ partNumber: p.partNumber, etag: p.etag })),
    }
  }

  const cfg = getSupabaseStorageConfig()
  if (!cfg) throw new Error('Storage not configured')
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(cfg.url, cfg.key, { auth: { persistSession: false } })
  const { data, error } = await supabase.storage.from(cfg.bucket).createSignedUploadUrl(row.key, { upsert: false })
  if (error || !data) throw new Error(error?.message || 'Could not refresh upload token')
  const tusEndpoint = `${cfg.url}/storage/v1/upload/resumable`
  const mode = totalBytes <= SIGNED_PUT_MAX_BYTES ? 'signed_put' : 'tus'
  const storageSession: CreateUploadResult =
    mode === 'signed_put'
      ? {
          mode: 'signed_put',
          signedPut: { url: data.signedUrl, token: data.token },
          tus: { endpoint: tusEndpoint, bucket: cfg.bucket, objectKey: row.key, token: data.token },
        }
      : {
          mode: 'tus',
          tus: { endpoint: tusEndpoint, bucket: cfg.bucket, objectKey: row.key, token: data.token },
        }

  const remoteSize = await storage.getObjectSizeBytes(row.key)
  const received = remoteSize ?? 0

  return {
    uploadId: row.id,
    bytes: totalBytes,
    received,
    filename: row.filename,
    storage: storageSession,
    completedParts: [],
  }
}

export async function getClipUploadProgress(workspaceId: string, uploadId: string) {
  const prisma = getPrisma()
  const row = await prisma.clipUpload.findFirst({ where: { id: uploadId, workspaceId } })
  if (!row) throw new Error('Upload not found')
  const totalBytes = Number(row.bytes)
  const storage = getClipStorage()
  let received = 0
  if (row.status === 'COMPLETE') {
    received = totalBytes
  } else if (row.uploadMode === 's3_multipart' && row.s3UploadId) {
    const parts = await listUploadParts(uploadId)
    received = bytesReceivedFromParts(parts, s3PartSizeBytes(), totalBytes)
  } else {
    received = (await storage.getObjectSizeBytes(row.key)) ?? 0
  }
  return {
    uploadId: row.id,
    status: row.status,
    bytes: totalBytes,
    received,
    filename: row.filename,
    uploadMode: row.uploadMode ?? storageDriverName(),
    canResume: row.status === 'PENDING',
  }
}

/** @deprecated App-chunk uploads are disabled — returns 410 from route. */
export async function writeClipUploadChunk() {
  throw new Error('Server chunk staging is disabled — upload directly to storage and use Resume')
}
