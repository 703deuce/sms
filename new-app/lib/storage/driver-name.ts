import type { StorageDriverName } from '@/lib/storage/types'

export function storageDriverName(): StorageDriverName {
  const raw = (process.env.STORAGE_DRIVER?.trim() || 'supabase').toLowerCase()
  if (raw === 'r2') return 'r2'
  if (raw === 's3') return 's3'
  return 'supabase'
}

export function usesS3CompatibleMultipart(): boolean {
  const d = storageDriverName()
  return d === 's3' || d === 'r2'
}
