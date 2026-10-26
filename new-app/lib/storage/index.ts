import 'server-only'
import { storageDriverName, usesS3CompatibleMultipart } from '@/lib/storage/driver-name'
import { getClipStorage, getClipStorageForObjectKey, normalizeStorageDriver } from '@/lib/storage/resolve'
import { getS3Config } from '@/lib/storage/s3'
import { getSupabaseStorageConfig } from '@/lib/storage/supabase-driver'

export * from '@/lib/storage/paths'
export type { ClipStorageDriver, CreateUploadResult, StorageDriverName } from '@/lib/storage/types'
export { storageDriverName, usesS3CompatibleMultipart, normalizeStorageDriver }
export { getClipStorage, getClipStorageForObjectKey }

export function isStorageConfigured(): boolean {
  const driver = storageDriverName()
  if (driver === 's3') return Boolean(getS3Config())
  return Boolean(getSupabaseStorageConfig())
}
