import 'server-only'
import { storageDriverName } from '@/lib/storage/driver-name'
import { getR2Config, R2_MULTIPART_PART_BYTES } from '@/lib/storage/r2'
import type { S3Config } from '@/lib/storage/s3'
import { getS3Config } from '@/lib/storage/s3'

const S3_MULTIPART_PART_BYTES = 10 * 1024 * 1024

export function multipartPartSizeBytes(): number {
  if (storageDriverName() === 'r2') return R2_MULTIPART_PART_BYTES
  return S3_MULTIPART_PART_BYTES
}

export function getActiveMultipartS3Config(): S3Config | null {
  const driver = storageDriverName()
  if (driver === 'r2') return getR2Config()
  if (driver === 's3') return getS3Config()
  return null
}
