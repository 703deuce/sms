import type { ClipStorageDriver } from '@/lib/storage/types'

/** Long TTL so browsers can cache; URLs are memoized per object version. */
export const CLIPS_BROWSER_DOWNLOAD_TTL_SEC = 7 * 24 * 3600

const CACHE_CONTROL_IMMUTABLE = 'private, max-age=31536000, immutable'

type CacheRow = { url: string; version: string; untilMs: number }

const urlCache = new Map<string, CacheRow>()

async function objectVersionToken(
  storage: ClipStorageDriver,
  objectKey: string,
): Promise<string> {
  if (storage.getObjectVersionToken) {
    return storage.getObjectVersionToken(objectKey)
  }
  const size = await storage.getObjectSizeBytes(objectKey)
  return size != null ? `size:${size}` : objectKey
}

export async function createCachedSignedDownloadUrl(
  storage: ClipStorageDriver,
  objectKey: string,
  options?: { downloadFilename?: string },
  expiresInSec: number = CLIPS_BROWSER_DOWNLOAD_TTL_SEC,
): Promise<string> {
  const version = await objectVersionToken(storage, objectKey)
  const cacheKey = `${objectKey}:${version}:${options?.downloadFilename ?? ''}`
  const now = Date.now()
  const hit = urlCache.get(cacheKey)
  if (hit && hit.untilMs > now + 60_000) {
    return hit.url
  }
  const url = await storage.createSignedDownloadUrl(objectKey, expiresInSec, options)
  urlCache.set(cacheKey, { url, version, untilMs: now + expiresInSec * 1000 })
  return url
}

export { CACHE_CONTROL_IMMUTABLE }
