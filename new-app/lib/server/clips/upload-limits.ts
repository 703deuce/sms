import 'server-only'
import { SIGNED_PUT_MAX_BYTES } from '@/lib/storage/supabase-driver'
import { storageDriverName, usesS3CompatibleMultipart } from '@/lib/storage/driver-name'

/** Per-object limit on many Supabase buckets (raise in dashboard when plan allows). */
export const SUPABASE_OBJECT_MAX_BYTES_DEFAULT = 50 * 1024 * 1024
export const CLIPS_UPLOAD_MAX_BYTES_STREAMER_DEFAULT = 20 * 1024 * 1024 * 1024
export const CLIPS_UPLOAD_MAX_BYTES_S3_DEFAULT = 20 * 1024 * 1024 * 1024
export const CLIPS_APP_CHUNK_BYTES = 8 * 1024 * 1024

export function supabaseObjectMaxBytes(): number {
  const raw = process.env.SUPABASE_OBJECT_MAX_BYTES?.trim() || process.env.SUPABASE_BUCKET_FILE_SIZE_LIMIT?.trim()
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return SUPABASE_OBJECT_MAX_BYTES_DEFAULT
}

export function clipUploadMaxBytes(): number {
  const clipRaw =
    process.env.CLIPS_MAX_UPLOAD_BYTES?.trim() ||
    process.env.CLIPS_UPLOAD_MAX_BYTES?.trim()
  const streamRaw = process.env.STREAMER_UPLOAD_MAX_BYTES?.trim()
  const raw = clipRaw || streamRaw
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return CLIPS_UPLOAD_MAX_BYTES_STREAMER_DEFAULT
}

export function formatClipUploadMaxLabel(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    const gb = bytes / (1024 * 1024 * 1024)
    return gb >= 10 ? `${Math.round(gb)} GB` : `${gb.toFixed(gb >= 1 ? 0 : 1)} GB`.replace(/\.0 GB/, ' GB')
  }
  const mb = Math.round(bytes / (1024 * 1024))
  return `${mb} MB`
}

/** @deprecated Chunks must never touch the web container — browser uploads go direct to storage (TUS or S3 multipart). */
export function shouldUseAppChunkedUpload(_bytes: number): boolean {
  return false
}

/** Bytes the browser may actually upload (app cap ∩ storage per-object / plan limit). */
export function clipUploadEffectiveMaxBytes(): number {
  const appMax = clipUploadMaxBytes()
  if (usesS3CompatibleMultipart()) return appMax
  return Math.min(appMax, supabaseObjectMaxBytes())
}

export function clipUploadLimitsPublic() {
  const policyMaxBytes = clipUploadMaxBytes()
  const effectiveMaxBytes = clipUploadEffectiveMaxBytes()
  const objectMax = usesS3CompatibleMultipart() ? policyMaxBytes : supabaseObjectMaxBytes()
  return {
    /** Effective limit — use for UI hints and client-side rejection. */
    maxBytes: effectiveMaxBytes,
    maxLabel: formatClipUploadMaxLabel(effectiveMaxBytes),
    effectiveMaxBytes,
    effectiveMaxLabel: formatClipUploadMaxLabel(effectiveMaxBytes),
    policyMaxBytes,
    policyMaxLabel: formatClipUploadMaxLabel(policyMaxBytes),
    chunkBytes: CLIPS_APP_CHUNK_BYTES,
    driver: storageDriverName(),
    supabaseObjectMaxBytes: objectMax,
    supabaseObjectMaxLabel: formatClipUploadMaxLabel(objectMax),
    usesStagingAboveObjectMax: false,
  }
}
