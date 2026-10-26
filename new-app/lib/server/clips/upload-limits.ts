import 'server-only'
import { SIGNED_PUT_MAX_BYTES } from '@/lib/storage/supabase-driver'
import { storageDriverName } from '@/lib/storage'

/** Default cap when using Supabase (free-tier global limit is often 50 MB per object). */
export const CLIPS_UPLOAD_MAX_BYTES_SUPABASE_DEFAULT = 50 * 1024 * 1024
export const CLIPS_UPLOAD_MAX_BYTES_S3_DEFAULT = 5 * 1024 * 1024 * 1024
export const CLIPS_APP_CHUNK_BYTES = 8 * 1024 * 1024

export function clipUploadMaxBytes(): number {
  const raw = process.env.CLIPS_UPLOAD_MAX_BYTES?.trim()
  if (raw) {
    const n = Number(raw)
    if (Number.isFinite(n) && n > 0) return Math.floor(n)
  }
  return storageDriverName() === 's3' ? CLIPS_UPLOAD_MAX_BYTES_S3_DEFAULT : CLIPS_UPLOAD_MAX_BYTES_SUPABASE_DEFAULT
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
  return bytes > SIGNED_PUT_MAX_BYTES
}

export function clipUploadLimitsPublic() {
  const maxBytes = clipUploadMaxBytes()
  return {
    maxBytes,
    maxLabel: formatClipUploadMaxLabel(maxBytes),
    chunkBytes: CLIPS_APP_CHUNK_BYTES,
    driver: storageDriverName(),
  }
}
