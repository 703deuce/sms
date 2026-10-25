import 'server-only'
import { createS3StorageDriver } from '@/lib/storage/s3-driver'
import { createSupabaseStorageDriver } from '@/lib/storage/supabase-driver'
import type { ClipStorageDriver, StorageDriverName } from '@/lib/storage/types'

export * from '@/lib/storage/paths'
export type { ClipStorageDriver, CreateUploadResult } from '@/lib/storage/types'

export function storageDriverName(): StorageDriverName {
  const raw = (process.env.STORAGE_DRIVER?.trim() || 'supabase').toLowerCase()
  return raw === 's3' ? 's3' : 'supabase'
}

export function getClipStorage(): ClipStorageDriver {
  return storageDriverName() === 's3' ? createS3StorageDriver() : createSupabaseStorageDriver()
}

export function isStorageConfigured(): boolean {
  if (storageDriverName() === 's3') {
    const { getS3Config } = require('@/lib/storage/s3') as typeof import('@/lib/storage/s3')
    return Boolean(getS3Config())
  }
  const { getSupabaseStorageConfig } = require('@/lib/storage/supabase-driver') as typeof import('@/lib/storage/supabase-driver')
  return Boolean(getSupabaseStorageConfig())
}
