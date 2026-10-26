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

async function uploadAppChunked(
  file: File,
  uploadId: string,
  chunkUrl: string,
  chunkBytes: number,
  base: UploadProgress,
  onProgress: (p: UploadProgress) => void,
) {
  let offset = 0
  while (offset < file.size) {
    const slice = file.slice(offset, Math.min(file.size, offset + chunkBytes))
    const res = await fetch(chunkUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Upload-Offset': String(offset),
      },
      body: slice,
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string }
      throw Object.assign(new Error(json.error || `Chunk upload failed (${res.status})`), { status: res.status })
    }
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

export async function uploadClipFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
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

  const base: UploadProgress = {
    filename: file.name,
    bytes: file.size,
    loaded: 0,
    percent: 0,
    state: 'uploading',
  }
  onProgress(base)

  try {
    const started = await startUpload({ filename: file.name, bytes: file.size, mime: file.type || 'video/mp4' })
    const { uploadId, storage } = started
    const durationMs = await probeDurationMs(file)

    let multipartParts: { partNumber: number; etag: string }[] | undefined

    if (storage.mode === 'app_chunked' && storage.appChunked) {
      await uploadAppChunked(file, uploadId, storage.appChunked.chunkUrl, storage.appChunked.chunkBytes, base, onProgress)
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
    onProgress({
      ...base,
      loaded: base.loaded,
      percent: base.bytes ? Math.min(99, Math.round((base.loaded / base.bytes) * 100)) : 0,
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
