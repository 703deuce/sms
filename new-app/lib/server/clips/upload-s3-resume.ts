import 'server-only'
import type { CreateUploadResult } from '@/lib/storage/types'
import { getActiveMultipartS3Config, multipartPartSizeBytes } from '@/lib/storage/multipart-config'
import { getS3Client, presignUploadPartUrl } from '@/lib/storage/s3'
import { missingPartNumbers, type UploadPartRecord } from '@/lib/server/clips/upload-part-bookkeeping'

export function s3PartSizeBytes(): number {
  return multipartPartSizeBytes()
}

export async function buildS3MultipartResumeSession(
  objectKey: string,
  s3UploadId: string,
  totalBytes: number,
  recordedParts: UploadPartRecord[],
): Promise<CreateUploadResult['s3Multipart']> {
  const cfg = getActiveMultipartS3Config()
  if (!cfg) throw new Error('S3-compatible storage is not configured')
  const partSize = multipartPartSizeBytes()
  const signClient = getS3Client(cfg)
  const missing = missingPartNumbers(recordedParts, partSize, totalBytes)
  const partUrls: { partNumber: number; url: string }[] = []
  for (const partNumber of missing) {
    partUrls.push({
      partNumber,
      url: await presignUploadPartUrl(signClient, cfg.bucket, objectKey, s3UploadId, partNumber),
    })
  }
  return { uploadId: s3UploadId, partSize, partUrls }
}
