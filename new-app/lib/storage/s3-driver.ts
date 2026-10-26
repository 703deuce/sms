import { createS3CompatibleStorageDriver } from '@/lib/storage/s3-compatible-driver'
import { getS3Config } from '@/lib/storage/s3'

const S3_PART_SIZE = 10 * 1024 * 1024

export function createS3StorageDriver() {
  return createS3CompatibleStorageDriver('s3', getS3Config, S3_PART_SIZE)
}
