import { createS3CompatibleStorageDriver } from '@/lib/storage/s3-compatible-driver'
import { getR2Config, R2_MULTIPART_PART_BYTES } from '@/lib/storage/r2'

export function createR2StorageDriver() {
  return createS3CompatibleStorageDriver('r2', getR2Config, R2_MULTIPART_PART_BYTES)
}
