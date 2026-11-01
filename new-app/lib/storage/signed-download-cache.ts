import type { ClipStorageDriver } from '@/lib/storage/types'

/** Long TTL so browsers can cache; URLs are memoized per object version. */
export const CLIPS_BROWSER_DOWNLOAD_TTL_SEC = 7 * 24 * 3600
/**
 * G4afix: the clip editor's media (proxy / source / segment / preview) is signed with this slightly
 * shorter TTL, so its URL differs from the one other pages play without CORS. Browsers key their
 * HTTP cache by URL: a response cached from a no-CORS <video> load (objects are stored with
 * `immutable`, and B2 does not vary on Origin) was reused for the editor's crossOrigin request and
 * failed the CORS check — the WebGL grade preview then said "does not allow pixel access".
 */
export const CLIPS_EDITOR_MEDIA_TTL_SEC = CLIPS_BROWSER_DOWNLOAD_TTL_SEC - 3600

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

export type SignedDownloadUrlOptions = {
  downloadFilename?: string
  /** When set, skips storage HEAD for cache versioning (list views). */
  versionHint?: string
}

export async function createCachedSignedDownloadUrl(
  storage: ClipStorageDriver,
  objectKey: string,
  options?: SignedDownloadUrlOptions,
  expiresInSec: number = CLIPS_BROWSER_DOWNLOAD_TTL_SEC,
): Promise<string> {
  const version =
    options?.versionHint?.trim() ||
    (await objectVersionToken(storage, objectKey))
  const cacheKey = `${objectKey}:${version}:${options?.downloadFilename ?? ''}:${expiresInSec}`
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
