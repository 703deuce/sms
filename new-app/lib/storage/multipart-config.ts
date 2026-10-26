import 'server-only'
import { storageDriverName } from '@/lib/storage/driver-name'
import { getS3Config, S3_MULTIPART_PART_BYTES } from '@/lib/storage/s3'
import type { S3Config } from '@/lib/storage/s3'

export function multipartPartSizeBytes(): number {
  return S3_MULTIPART_PART_BYTES
}

export function getActiveMultipartS3Config(): S3Config | null {
  if (storageDriverName() === 's3') return getS3Config()
  return null
}
