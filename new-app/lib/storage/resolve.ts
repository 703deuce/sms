import 'server-only'
import { createS3StorageDriver } from '@/lib/storage/s3-driver'
import { createSupabaseStorageDriver } from '@/lib/storage/supabase-driver'
import { storageDriverName } from '@/lib/storage/driver-name'
import {
  createCachedSignedDownloadUrl,
  type SignedDownloadUrlOptions,
} from '@/lib/storage/signed-download-cache'
import type { ClipStorageDriver, StorageDriverName } from '@/lib/storage/types'

export function normalizeStorageDriver(raw?: string | null): StorageDriverName | null {
  const v = raw?.trim().toLowerCase()
  if (v === 'r2') return 's3' // legacy label → same S3-compatible path
  if (v === 's3' || v === 'supabase') return v
  return null
}

export function getClipStorage(driver?: string | null): ClipStorageDriver {
  const name = normalizeStorageDriver(driver) ?? storageDriverName()
  if (name === 's3') return createS3StorageDriver()
  return createSupabaseStorageDriver()
}

/** Read legacy Supabase objects after switching default driver to B2/S3. */
export async function getClipStorageForObjectKey(
  objectKey: string,
  driverHint?: string | null,
): Promise<ClipStorageDriver> {
  if (driverHint) return getClipStorage(driverHint)
  const primary = getClipStorage()
  if (primary.name === 'supabase') return primary
  const size = await primary.getObjectSizeBytes(objectKey)
  if (size !== null) return primary
  return createSupabaseStorageDriver()
}

/** Signed GET with legacy Supabase fallback when the object predates B2 cutover. */
export async function createSignedDownloadUrlForObjectKey(
  objectKey: string,
  options?: SignedDownloadUrlOptions,
  expiresInSec?: number,
): Promise<string> {
  const storage = await getClipStorageForObjectKey(objectKey)
  return createCachedSignedDownloadUrl(storage, objectKey, options, expiresInSec)
}
