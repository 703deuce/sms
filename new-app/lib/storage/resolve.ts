import 'server-only'
import { createS3StorageDriver } from '@/lib/storage/s3-driver'
import { createSupabaseStorageDriver } from '@/lib/storage/supabase-driver'
import { storageDriverName } from '@/lib/storage/driver-name'
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

/**
 * E6fix: memo of which driver holds a key. AI covers / AI b-roll were written straight to Supabase
 * Storage by the Kie callback while reads signed against the primary (B2) driver → every cover
 * 404'd (NoSuchKey). Objects never move, so the answer is cached per key; a miss on both drivers
 * is not cached (the object may simply not exist yet / a HEAD timed out).
 */
const driverByKey = new Map<string, StorageDriverName>()
const DRIVER_MEMO_MAX = 5000

export async function getReadableClipStorage(objectKey: string): Promise<ClipStorageDriver> {
  const hit = driverByKey.get(objectKey)
  if (hit) return getClipStorage(hit)
  const primary = getClipStorage()
  if (primary.name === 'supabase') return primary
  const remember = (name: StorageDriverName) => {
    if (driverByKey.size >= DRIVER_MEMO_MAX) driverByKey.clear()
    driverByKey.set(objectKey, name)
  }
  if ((await primary.getObjectSizeBytes(objectKey)) !== null) {
    remember(primary.name)
    return primary
  }
  const legacy = createSupabaseStorageDriver()
  if ((await legacy.getObjectSizeBytes(objectKey).catch(() => null)) !== null) {
    remember('supabase')
    return legacy
  }
  return primary
}

/** Signed GET URL from whichever driver actually holds the object (see getReadableClipStorage). */
export async function createReadableSignedUrl(
  objectKey: string,
  expiresInSec: number,
  options?: { downloadFilename?: string },
): Promise<string> {
  const storage = await getReadableClipStorage(objectKey)
  return storage.createSignedDownloadUrl(objectKey, expiresInSec, options)
}

/** Test hook. */
export function __resetReadableDriverMemo(): void {
  driverByKey.clear()
}
