import 'server-only'
import { SIGNED_PUT_MAX_BYTES } from '@/lib/storage/supabase-driver'
import { storageDriverName } from '@/lib/storage'

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
  const clipRaw = process.env.CLIPS_UPLOAD_MAX_BYTES?.trim()
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

/** Browser uploads above signed-PUT size should not use Supabase TUS (413 on many plans). */
export function shouldUseAppChunkedUpload(bytes: number): boolean {
  if (storageDriverName() === 's3') return false
  if (bytes > supabaseObjectMaxBytes()) return true
  return bytes > SIGNED_PUT_MAX_BYTES
}

export function clipUploadLimitsPublic() {
  const maxBytes = clipUploadMaxBytes()
  const objectMax = storageDriverName() === 's3' ? maxBytes : supabaseObjectMaxBytes()
  return {
    maxBytes,
    maxLabel: formatClipUploadMaxLabel(maxBytes),
    chunkBytes: CLIPS_APP_CHUNK_BYTES,
    driver: storageDriverName(),
    supabaseObjectMaxBytes: objectMax,
    supabaseObjectMaxLabel: formatClipUploadMaxLabel(objectMax),
    usesStagingAboveObjectMax: false,
  }
}
