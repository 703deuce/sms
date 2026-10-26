import type { S3Config } from '@/lib/storage/s3'

/** Default multipart part size for browser → R2 uploads (within 16–64 MB spec). */
export const R2_MULTIPART_PART_BYTES = 32 * 1024 * 1024

export function getR2Config(): S3Config | null {
  const accountId = process.env.R2_ACCOUNT_ID?.trim()
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim()
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim()
  const bucket = process.env.R2_BUCKET?.trim()
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`
  const publicEndpoint = process.env.R2_PUBLIC_ENDPOINT?.trim()
  return {
    endpoint: publicEndpoint || endpoint,
    region: process.env.R2_REGION?.trim() || 'auto',
    bucket,
    accessKeyId,
    secretAccessKey,
    forcePathStyle: true,
    _internalEndpoint: endpoint,
  } as S3Config & { _internalEndpoint?: string }
}

export function isR2Configured(): boolean {
  return Boolean(getR2Config())
}
