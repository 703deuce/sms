import 'server-only'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import type { ClipStorageDriver } from '@/lib/storage/types'
import { chunkFilePath, openChunkReadStream, removeChunkFile } from '@/lib/server/clips/app-chunk-store'
import { getS3Config, getInternalS3Client, createMultipartUpload, completeMultipartUpload, abortMultipartUpload } from '@/lib/storage/s3'
import { getSupabaseStorageConfig } from '@/lib/storage/supabase-driver'
import { supabaseObjectMaxBytes } from '@/lib/server/clips/upload-limits'

const MULTIPART_PART_BYTES = 10 * 1024 * 1024

/** After app-chunk assembly, persist to object storage (never local worker staging). */
export async function finalizeAssembledUploadToStorageKey(
  storage: ClipStorageDriver,
  objectKey: string,
  uploadId: string,
  mime: string,
  totalBytes: number,
): Promise<string> {
  if (objectKey.startsWith('@staging/')) {
    throw new Error('Invalid staging object key — upload must use storage key')
  }

  const existingSize = await storage.getObjectSizeBytes(objectKey)
  if (existingSize !== null && existingSize === totalBytes) {
    await removeChunkFile(uploadId).catch(() => {})
    return objectKey
  }

  const path = chunkFilePath(uploadId)
  const stat = await fsp.stat(path).catch(() => null)
  if (!stat || stat.size !== totalBytes) {
    throw new Error(`Incomplete upload (${stat?.size ?? 0} of ${totalBytes} bytes received)`)
  }

  const s3 = getS3Config()
  const supCfg = getSupabaseStorageConfig()
  const bucketMatches = s3 && (!supCfg?.bucket || s3.bucket === supCfg.bucket)

  if (s3 && bucketMatches && totalBytes > supabaseObjectMaxBytes()) {
    await uploadPathMultipartS3(path, s3, objectKey, mime, totalBytes)
  } else if (s3 && bucketMatches && totalBytes > MULTIPART_PART_BYTES) {
    await uploadPathMultipartS3(path, s3, objectKey, mime, totalBytes)
  } else {
    const stream = fs.createReadStream(path)
    await storage.putStream(objectKey, stream, mime)
  }

  await removeChunkFile(uploadId).catch(() => {})
  return objectKey
}

async function uploadPathMultipartS3(
  filePath: string,
  cfg: NonNullable<ReturnType<typeof getS3Config>>,
  objectKey: string,
  mime: string,
  totalBytes: number,
) {
  const client = getInternalS3Client(cfg)
  const uploadId = await createMultipartUpload(client, cfg.bucket, objectKey, mime)
  const parts: { partNumber: number; etag: string }[] = []
  const fd = await fsp.open(filePath, 'r')
  try {
    let partNumber = 1
    for (let offset = 0; offset < totalBytes; offset += MULTIPART_PART_BYTES) {
      const len = Math.min(MULTIPART_PART_BYTES, totalBytes - offset)
      const buf = Buffer.alloc(len)
      const { bytesRead } = await fd.read(buf, 0, len, offset)
      if (bytesRead !== len) throw new Error('Short read during multipart upload')
      const { UploadPartCommand } = await import('@aws-sdk/client-s3')
      const out = await client.send(
        new UploadPartCommand({
          Bucket: cfg.bucket,
          Key: objectKey,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: buf,
        }),
      )
      if (!out.ETag) throw new Error('S3 part missing ETag')
      parts.push({ partNumber, etag: out.ETag })
      partNumber += 1
    }
    await completeMultipartUpload(client, cfg.bucket, objectKey, uploadId, parts)
  } catch (err) {
    await abortMultipartUpload(client, cfg.bucket, objectKey, uploadId).catch(() => {})
    throw err
  } finally {
    await fd.close()
  }
}

/** @deprecated staging keys are no longer written; kept for tests and legacy detection. */
export { isStagingObjectKey, STAGING_KEY_PREFIX } from '@/lib/server/clips/upload-staging'
