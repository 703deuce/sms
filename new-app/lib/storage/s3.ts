import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/** B2 multipart requires 5 MB–5 GB per part; browser uploads use 16–64 MB (default 32 MB). */
export const S3_MULTIPART_PART_BYTES = (() => {
  const raw = process.env.S3_MULTIPART_PART_BYTES?.trim()
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n >= 5 * 1024 * 1024) return Math.floor(n)
  }
  return 32 * 1024 * 1024
})()

export type S3Config = {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  forcePathStyle?: boolean
}

export function getS3Config(): S3Config | null {
  const endpoint = process.env.S3_ENDPOINT?.trim()
  const publicEndpoint = process.env.S3_PUBLIC_ENDPOINT?.trim()
  const bucket = process.env.S3_BUCKET?.trim()
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim()
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null
  return {
    endpoint: publicEndpoint || endpoint,
    region: process.env.S3_REGION?.trim() || 'us-east-1',
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    _internalEndpoint: endpoint,
  } as S3Config & { _internalEndpoint?: string }
}

export function getS3Client(cfg: S3Config, opts?: { internal?: boolean }): S3Client {
  const internal = (cfg as S3Config & { _internalEndpoint?: string })._internalEndpoint
  const endpoint = opts?.internal && internal ? internal : cfg.endpoint
  return new S3Client({
    endpoint,
    region: cfg.region,
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: cfg.secretAccessKey,
    },
    forcePathStyle: cfg.forcePathStyle ?? true,
  })
}

export {
  uploadSourceKey,
  projectWordsKey,
  projectProxyKey,
  projectThumbKey,
} from '@/lib/storage/paths'

export async function presignPutUrl(client: S3Client, bucket: string, key: string, expiresIn = 3600) {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  )
}

export async function presignUploadPartUrl(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
) {
  return getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn },
  )
}

export async function createMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  contentType: string,
) {
  const out = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  )
  if (!out.UploadId) throw new Error('S3 did not return UploadId')
  return out.UploadId
}

export async function completeMultipartUpload(
  client: S3Client,
  bucket: string,
  key: string,
  uploadId: string,
  parts: { partNumber: number; etag: string }[],
) {
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => ({ ETag: p.etag, PartNumber: p.partNumber })),
      },
    }),
  )
}

export async function abortMultipartUpload(client: S3Client, bucket: string, key: string, uploadId: string) {
  await client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    }),
  )
}

export function getInternalS3Client(cfg: S3Config): S3Client {
  return getS3Client(cfg, { internal: true })
}

export async function putObjectJson(client: S3Client, bucket: string, key: string, data: unknown) {
  const body = JSON.stringify(data)
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'application/json',
    }),
  )
}

export async function getObjectJson<T>(client: S3Client, bucket: string, key: string): Promise<T> {
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
  const text = await out.Body?.transformToString()
  if (!text) throw new Error('Empty S3 object')
  return JSON.parse(text) as T
}

export async function deleteObject(client: S3Client, bucket: string, key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
}
