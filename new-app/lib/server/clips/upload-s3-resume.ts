import 'server-only'
import type { CreateUploadResult } from '@/lib/storage/types'
import { getS3Client, getS3Config, presignUploadPartUrl } from '@/lib/storage/s3'
import { missingPartNumbers, type UploadPartRecord } from '@/lib/server/clips/upload-part-bookkeeping'

const PART_SIZE = 10 * 1024 * 1024

export function s3PartSizeBytes(): number {
  return PART_SIZE
}

export async function buildS3MultipartResumeSession(
  objectKey: string,
  s3UploadId: string,
  totalBytes: number,
  recordedParts: UploadPartRecord[],
): Promise<CreateUploadResult['s3Multipart']> {
  const cfg = getS3Config()
  if (!cfg) throw new Error('S3 storage is not configured')
  const signClient = getS3Client(cfg)
  const missing = missingPartNumbers(recordedParts, PART_SIZE, totalBytes)
  const partUrls: { partNumber: number; url: string }[] = []
  for (const partNumber of missing) {
    partUrls.push({
      partNumber,
      url: await presignUploadPartUrl(signClient, cfg.bucket, objectKey, s3UploadId, partNumber),
    })
  }
  return { uploadId: s3UploadId, partSize: PART_SIZE, partUrls }
}
