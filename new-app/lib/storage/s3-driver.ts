import type { ClipStorageDriver, CompleteUploadInput, CreateUploadInput, CreateUploadResult } from '@/lib/storage/types'
import {
  abortMultipartUpload,
  completeMultipartUpload,
  createMultipartUpload,
  getInternalS3Client,
  getS3Client,
  getS3Config,
  getObjectJson,
  presignUploadPartUrl,
  putObjectJson,
} from '@/lib/storage/s3'

const PART_SIZE = 10 * 1024 * 1024
const MAX_PARTS = 10_000

export function createS3StorageDriver(): ClipStorageDriver {
  return {
    name: 's3',
    async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 storage is not configured')
      const signClient = getS3Client(cfg)
      const internal = getInternalS3Client(cfg)
      const s3UploadId = await createMultipartUpload(internal, cfg.bucket, input.objectKey, input.mime)
      const partCount = Math.min(MAX_PARTS, Math.max(1, Math.ceil(input.bytes / PART_SIZE)))
      const partUrls: { partNumber: number; url: string }[] = []
      for (let partNumber = 1; partNumber <= partCount; partNumber++) {
        partUrls.push({
          partNumber,
          url: await presignUploadPartUrl(signClient, cfg.bucket, input.objectKey, s3UploadId, partNumber),
        })
      }
      return {
        mode: 's3_multipart',
        s3Multipart: { uploadId: s3UploadId, partSize: PART_SIZE, partUrls },
      }
    },
    async completeUpload(input: CompleteUploadInput): Promise<void> {
      const cfg = getS3Config()
      if (!cfg || !input.s3UploadId) throw new Error('S3 upload incomplete')
      await completeMultipartUpload(
        getInternalS3Client(cfg),
        cfg.bucket,
        input.objectKey,
        input.s3UploadId,
        input.parts || [],
      )
    },
    async abortUpload(input: { objectKey: string; s3UploadId?: string | null }): Promise<void> {
      const cfg = getS3Config()
      if (!cfg || !input.s3UploadId) return
      await abortMultipartUpload(getInternalS3Client(cfg), cfg.bucket, input.objectKey, input.s3UploadId)
    },
    async putStream(objectKey: string, body: NodeJS.ReadableStream, contentType: string): Promise<void> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 not configured')
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await getInternalS3Client(cfg).send(
        new PutObjectCommand({ Bucket: cfg.bucket, Key: objectKey, Body: body, ContentType: contentType }),
      )
    },
    async putBytes(objectKey: string, body: Buffer, contentType: string): Promise<void> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 not configured')
      const { PutObjectCommand } = await import('@aws-sdk/client-s3')
      await getInternalS3Client(cfg).send(
        new PutObjectCommand({ Bucket: cfg.bucket, Key: objectKey, Body: body, ContentType: contentType }),
      )
    },
    async putJson(objectKey: string, data: unknown): Promise<void> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 not configured')
      await putObjectJson(getInternalS3Client(cfg), cfg.bucket, objectKey, data)
    },
    async getJson<T>(objectKey: string): Promise<T> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 not configured')
      return getObjectJson<T>(getInternalS3Client(cfg), cfg.bucket, objectKey)
    },
    async createSignedDownloadUrl(
      objectKey: string,
      expiresInSec: number,
      options?: { downloadFilename?: string },
    ): Promise<string> {
      const cfg = getS3Config()
      if (!cfg) throw new Error('S3 not configured')
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner')
      const { GetObjectCommand } = await import('@aws-sdk/client-s3')
      const cmd = new GetObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        ResponseContentDisposition: options?.downloadFilename
          ? `attachment; filename="${options.downloadFilename.replace(/"/g, '')}"`
          : undefined,
      })
      return getSignedUrl(getS3Client(cfg), cmd, { expiresIn: expiresInSec })
    },
    async getObjectSizeBytes(objectKey: string): Promise<number | null> {
      const cfg = getS3Config()
      if (!cfg) return null
      const { HeadObjectCommand } = await import('@aws-sdk/client-s3')
      try {
        const out = await getInternalS3Client(cfg).send(
          new HeadObjectCommand({ Bucket: cfg.bucket, Key: objectKey }),
        )
        return typeof out.ContentLength === 'number' ? out.ContentLength : null
      } catch {
        return null
      }
    },
  }
}
