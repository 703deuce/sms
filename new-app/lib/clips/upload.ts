import * as tus from 'tus-js-client'
import { abortUpload, completeUpload, startUpload } from '@/lib/clips-api'
import { friendlyUploadError } from '@/lib/clips/upload-errors'

export type UploadProgress = {
  filename: string
  bytes: number
  loaded: number
  percent: number
  state: 'idle' | 'uploading' | 'complete' | 'error' | 'canceled'
  error?: string
  uploadId?: string
}

export type UploadLimits = {
  maxBytes: number
  maxLabel: string
  chunkBytes: number
  driver: string
  supabaseObjectMaxBytes?: number
  supabaseObjectMaxLabel?: string
  usesStagingAboveObjectMax?: boolean
}

let limitsCache: UploadLimits | null = null

export async function fetchUploadLimits(): Promise<UploadLimits> {
  if (limitsCache) return limitsCache
  const res = await fetch('/api/clips/uploads/limits')
  const json = (await res.json()) as { data?: UploadLimits; error?: string }
  if (!res.ok || !json.data) throw new Error(json.error || 'Could not load upload limits')
  limitsCache = json.data
  return json.data
}

async function probeDurationMs(file: File): Promise<number | undefined> {
  try {
    return await new Promise((resolve, reject) => {
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
  } catch {
    return undefined
  }
}

async function uploadAppChunkedFromOffset(
  file: File,
  uploadId: string,
  chunkUrl: string,
  chunkBytes: number,
  startOffset: number,
  base: UploadProgress,
  onProgress: (p: UploadProgress) => void,
) {
  await uploadAppChunked(file, uploadId, chunkUrl, chunkBytes, base, onProgress, startOffset)
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchChunkWithRetry(
  chunkUrl: string,
  offset: number,
  slice: Blob,
  maxAttempts = 5,
): Promise<Response> {
  let lastErr: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(chunkUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-Upload-Offset': String(offset),
        },
        body: slice,
      })
      if (res.ok) return res
      if (res.status >= 500 || res.status === 429 || res.status === 408) {
        lastErr = Object.assign(new Error(`Chunk upload failed (${res.status})`), { status: res.status })
        await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)))
        continue
      }
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw Object.assign(new Error(json.error || `Chunk upload failed (${res.status})`), { status: res.status })
    } catch (e) {
      lastErr = e
      if (attempt < maxAttempts) {
        await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)))
        continue
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Chunk upload failed')
}

async function uploadAppChunked(
  file: File,
  uploadId: string,
  chunkUrl: string,
  chunkBytes: number,
  base: UploadProgress,
  onProgress: (p: UploadProgress) => void,
  startOffset = 0,
) {
  let offset = startOffset
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(file.size, offset + chunkBytes))
    const res = await fetchChunkWithRetry(chunkUrl, offset, slice)
    const json = (await res.json()) as { data?: { received?: number } }
    offset = json.data?.received ?? offset + slice.size
    onProgress({
      ...base,
      uploadId,
      loaded: offset,
      percent: Math.min(100, Math.round((offset / file.size) * 100)),
      state: 'uploading',
    })
  }
}

async function uploadS3Multipart(
  file: File,
  storage: NonNullable<Awaited<ReturnType<typeof startUpload>>['storage']['s3Multipart']>,
  base: UploadProgress,
  uploadId: string,
  onProgress: (p: UploadProgress) => void,
): Promise<{ partNumber: number; etag: string }[]> {
  const parts: { partNumber: number; etag: string }[] = []
  let loaded = 0
  for (const part of storage.partUrls) {
    const start = (part.partNumber - 1) * storage.partSize
    const end = Math.min(file.size, start + storage.partSize)
    const blob = file.slice(start, end)
    const res = await fetch(part.url, { method: 'PUT', body: blob })
    if (!res.ok) {
      throw Object.assign(new Error(`Part ${part.partNumber} failed (${res.status})`), { status: res.status })
    }
    const etag = res.headers.get('etag')?.replace(/"/g, '') ?? ''
    if (!etag) throw new Error(`Part ${part.partNumber} missing ETag`)
    parts.push({ partNumber: part.partNumber, etag })
    loaded = end
    onProgress({
      ...base,
      uploadId,
      loaded,
      percent: Math.min(100, Math.round((loaded / file.size) * 100)),
      state: 'uploading',
    })
  }
  return parts
}

async function fetchUploadProgress(uploadId: string): Promise<{ received: number; bytes: number; canResume: boolean }> {
  const res = await fetch(`/api/clips/uploads/${uploadId}/progress`)
  const json = (await res.json()) as { data?: { received: number; bytes: number; canResume: boolean } }
  if (!res.ok || !json.data) throw new Error('Could not read upload progress')
  return json.data
}

export async function uploadClipFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
  opts?: { resumeUploadId?: string },
): Promise<{ uploadId: string }> {
  const limits = await fetchUploadLimits()
  if (file.size > limits.maxBytes) {
    const err = `File is too large (max ${limits.maxLabel})`
    onProgress({
      filename: file.name,
      bytes: file.size,
      loaded: 0,
      percent: 0,
      state: 'error',
      error: err,
    })
    throw new Error(err)
  }

  let uploadId: string | undefined = opts?.resumeUploadId
  const base: UploadProgress = {
    filename: file.name,
    bytes: file.size,
    loaded: 0,
    percent: 0,
    state: 'uploading',
    uploadId,
  }
  onProgress(base)

  try {
    let storage: Awaited<ReturnType<typeof startUpload>>['storage']
    let resumeOffset = 0

    if (opts?.resumeUploadId) {
      const res = await fetch(`/api/clips/uploads/${opts.resumeUploadId}/resume`)
      const json = (await res.json()) as {
        data?: { uploadId: string; bytes: number; received: number; chunkUrl: string; chunkBytes: number }
      }
      if (!res.ok || !json.data || json.data.bytes !== file.size) {
        throw new Error('Cannot resume this upload — start again')
      }
      uploadId = json.data.uploadId
      resumeOffset = json.data.received
      storage = {
        mode: 'app_chunked',
        appChunked: { chunkUrl: json.data.chunkUrl, chunkBytes: json.data.chunkBytes },
      }
      if (resumeOffset >= file.size) {
        await completeUpload(uploadId, { durationMs: await probeDurationMs(file) })
        onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'complete' })
        return { uploadId }
      }
      onProgress({
        ...base,
        uploadId,
        loaded: resumeOffset,
        percent: Math.min(99, Math.round((resumeOffset / file.size) * 100)),
        state: 'uploading',
      })
    } else {
      const started = await startUpload({ filename: file.name, bytes: file.size, mime: file.type || 'video/mp4' })
      uploadId = started.uploadId
      storage = started.storage
    }

    const durationMs = await probeDurationMs(file)

    let multipartParts: { partNumber: number; etag: string }[] | undefined

    if (!uploadId) throw new Error('Upload session missing')

    if (storage.mode === 'app_chunked' && storage.appChunked) {
      if (resumeOffset > 0) {
        await uploadAppChunkedFromOffset(
          file,
          uploadId,
          storage.appChunked.chunkUrl,
          storage.appChunked.chunkBytes,
          resumeOffset,
          base,
          onProgress,
        )
      } else {
        await uploadAppChunked(file, uploadId, storage.appChunked.chunkUrl, storage.appChunked.chunkBytes, base, onProgress)
      }
    } else if (storage.mode === 's3_multipart' && storage.s3Multipart) {
      multipartParts = await uploadS3Multipart(file, storage.s3Multipart, base, uploadId, onProgress)
    } else if (storage.mode === 'signed_put' && storage.signedPut && file.size <= 50 * 1024 * 1024) {
      const res = await fetch(storage.signedPut.url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${storage.signedPut.token}`,
          'Content-Type': file.type || 'video/mp4',
          'x-upsert': 'false',
        },
        body: file,
      })
      if (!res.ok) {
        throw Object.assign(new Error(`Upload failed (${res.status})`), { status: res.status })
      }
      onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'uploading' })
    } else {
      const tusInfo = storage.tus
      if (!tusInfo) throw new Error('Missing upload authorization')
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(file, {
          endpoint: tusInfo.endpoint,
          retryDelays: [0, 2000, 5000, 10000],
          chunkSize: 6 * 1024 * 1024,
          headers: { Authorization: `Bearer ${tusInfo.token}` },
          metadata: {
            bucketName: tusInfo.bucket,
            objectName: tusInfo.objectKey,
            contentType: file.type || 'video/mp4',
          },
          onError: (err) => reject(err),
          onProgress: (sent, total) => {
            onProgress({
              ...base,
              uploadId,
              loaded: sent,
              percent: total ? Math.min(100, Math.round((sent / total) * 100)) : 0,
              state: 'uploading',
            })
          },
          onSuccess: () => resolve(),
        })
        upload.start()
      })
    }

    await completeUpload(uploadId, { durationMs, parts: multipartParts })
    onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'complete' })
    return { uploadId }
  } catch (err) {
    const message = friendlyUploadError(err, (err as { status?: number }).status)
    const loaded = base.loaded
    onProgress({
      ...base,
      uploadId,
      loaded,
      percent: base.bytes ? Math.min(99, Math.round((loaded / base.bytes) * 100)) : 0,
      state: 'error',
      error: message,
    })
    throw err
  }
}

export async function cancelClipUpload(uploadId: string) {
  await abortUpload(uploadId)
}

export const multipartUploadFile = uploadClipFile
export const cancelMultipartUpload = cancelClipUpload
