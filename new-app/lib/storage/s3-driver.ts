import { createS3CompatibleStorageDriver } from '@/lib/storage/s3-compatible-driver'
import { getS3Config, S3_MULTIPART_PART_BYTES } from '@/lib/storage/s3'

export function createS3StorageDriver() {
  return createS3CompatibleStorageDriver(getS3Config, S3_MULTIPART_PART_BYTES)
}
