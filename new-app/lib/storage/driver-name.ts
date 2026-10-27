import type { StorageDriverName } from '@/lib/storage/types'

export function storageDriverName(): StorageDriverName {
  const raw = (process.env.STORAGE_DRIVER?.trim() || 's3').toLowerCase()
  if (raw === 's3') return 's3'
  return 'supabase'
}

export function usesS3CompatibleMultipart(): boolean {
  return storageDriverName() === 's3'
}
