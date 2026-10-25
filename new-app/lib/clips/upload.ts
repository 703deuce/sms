import { completeUpload, startUpload, abortUpload } from '@/lib/clips-api'

const PARALLEL = 4

export type UploadProgress = {
  filename: string
  bytes: number
  loaded: number
  percent: number
  state: 'idle' | 'uploading' | 'complete' | 'error' | 'canceled'
  error?: string
  uploadId?: string
}

async function putPart(url: string, blob: Blob, retries = 3): Promise<string> {
  let lastErr: unknown
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { method: 'PUT', body: blob })
      if (!res.ok) throw new Error(`Part upload failed (${res.status})`)
      const etag = res.headers.get('etag') || res.headers.get('ETag')
      if (!etag) throw new Error('Missing ETag')
      return etag.replace(/"/g, '')
    } catch (e) {
      lastErr = e
      await new Promise((r) => setTimeout(r, 500 * (i + 1)))
    }
  }
  throw lastErr
}

export async function multipartUploadFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
): Promise<{ uploadId: string }> {
  const base: UploadProgress = {
    filename: file.name,
    bytes: file.size,
    loaded: 0,
    percent: 0,
    state: 'uploading',
  }
  onProgress(base)
  const started = await startUpload({ filename: file.name, bytes: file.size, mime: file.type || 'video/mp4' })
  const { uploadId, partSize, partUrls } = started
  const parts: { partNumber: number; etag: string }[] = []
  let loaded = 0

  const queue = [...partUrls]
  const workers = Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const part = queue.shift()
      if (!part) break
      const start = (part.partNumber - 1) * partSize
      const end = Math.min(file.size, start + partSize)
      const blob = file.slice(start, end)
      const etag = await putPart(part.url, blob)
      parts.push({ partNumber: part.partNumber, etag })
      loaded += blob.size
      onProgress({
        ...base,
        uploadId,
        loaded,
        percent: Math.min(100, Math.round((loaded / file.size) * 100)),
        state: 'uploading',
      })
    }
  })
  await Promise.all(workers)

  let durationMs: number | undefined
  try {
    durationMs = await probeDurationMs(file)
  } catch {
    durationMs = undefined
  }

  await completeUpload(uploadId, { parts, durationMs })
  onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'complete' })
  return { uploadId }
}

export async function cancelMultipartUpload(uploadId: string) {
  await abortUpload(uploadId)
}

function probeDurationMs(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Math.round(video.duration * 1000))
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('metadata'))
    }
    video.src = url
  })
}
