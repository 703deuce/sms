import * as tus from 'tus-js-client'
import { abortUpload, completeUpload, startUpload } from '@/lib/clips-api'
import { friendlyUploadError, isUploadErrorRetryable } from '@/lib/clips/upload-errors'
import { uploadLimitExceededMessage } from '@/lib/clips/upload-limit-message'

export type UploadProgress = {
  filename: string
  bytes: number
  loaded: number
  percent: number
  state: 'idle' | 'uploading' | 'complete' | 'error' | 'canceled'
  error?: string
  uploadId?: string
  /** False for oversize / HTTP 413 — same file will always fail. */
  retryable?: boolean
}

export type UploadLimits = {
  maxBytes: number
  maxLabel: string
  effectiveMaxBytes: number
  effectiveMaxLabel: string
  policyMaxBytes?: number
  policyMaxLabel?: string
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

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

async function recordS3Part(uploadId: string, partNumber: number, etag: string, sizeBytes: number) {
  await fetch(`/api/clips/uploads/${uploadId}/parts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ partNumber, etag, sizeBytes }),
  })
}

async function uploadS3Multipart(
  file: File,
  storage: NonNullable<Awaited<ReturnType<typeof startUpload>>['storage']['s3Multipart']>,
  base: UploadProgress,
  uploadId: string,
  onProgress: (p: UploadProgress) => void,
  seedParts: { partNumber: number; etag: string }[] = [],
): Promise<{ partNumber: number; etag: string }[]> {
  const partsMap = new Map(seedParts.map((p) => [p.partNumber, p.etag]))
  let loaded = 0
  const partSize = storage.partSize
  for (const p of seedParts) {
    const start = (p.partNumber - 1) * partSize
    const end = Math.min(file.size, start + partSize)
    loaded = Math.max(loaded, end)
  }

  for (const part of storage.partUrls) {
    if (partsMap.has(part.partNumber)) continue
    const start = (part.partNumber - 1) * partSize
    const end = Math.min(file.size, start + partSize)
    const blob = file.slice(start, end)
    let lastErr: unknown
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        const res = await fetch(part.url, { method: 'PUT', body: blob })
        if (!res.ok) {
          throw Object.assign(new Error(`Part ${part.partNumber} failed (${res.status})`), { status: res.status })
        }
        const etag = res.headers.get('etag')?.replace(/"/g, '') ?? ''
        if (!etag) throw new Error(`Part ${part.partNumber} missing ETag`)
        partsMap.set(part.partNumber, etag)
        await recordS3Part(uploadId, part.partNumber, etag, blob.size)
        loaded = end
        onProgress({
          ...base,
          uploadId,
          loaded,
          percent: Math.min(100, Math.round((loaded / file.size) * 100)),
          state: 'uploading',
        })
        break
      } catch (e) {
        lastErr = e
        if (attempt < 5) await sleep(Math.min(30_000, 1000 * 2 ** (attempt - 1)))
      }
    }
    if (!partsMap.has(part.partNumber)) {
      throw lastErr instanceof Error ? lastErr : new Error(`Part ${part.partNumber} failed`)
    }
  }
  return [...partsMap.entries()]
    .map(([partNumber, etag]) => ({ partNumber, etag }))
    .sort((a, b) => a.partNumber - b.partNumber)
}

async function uploadTus(
  file: File,
  tusInfo: NonNullable<Awaited<ReturnType<typeof startUpload>>['storage']['tus']>,
  base: UploadProgress,
  uploadId: string,
  onProgress: (p: UploadProgress) => void,
) {
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
      fingerprint: (f) => Promise.resolve(`clip-${uploadId}-${f.size}-${f.name}`),
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
    upload.findPreviousUploads().then((prev) => {
      if (prev.length) upload.resumeFromPreviousUpload(prev[0])
      upload.start()
    })
  })
}

export async function uploadClipFile(
  file: File,
  onProgress: (p: UploadProgress) => void,
  opts?: { resumeUploadId?: string },
): Promise<{ uploadId: string }> {
  const limits = await fetchUploadLimits()
  const effectiveMax = limits.effectiveMaxBytes ?? limits.maxBytes
  let maxLabel = limits.effectiveMaxLabel ?? limits.maxLabel
  if (file.size > effectiveMax) {
    const err = uploadLimitExceededMessage(maxLabel)
    onProgress({
      filename: file.name,
      bytes: file.size,
      loaded: 0,
      percent: 0,
      state: 'error',
      error: err,
      retryable: false,
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
    let seedParts: { partNumber: number; etag: string }[] = []

    if (opts?.resumeUploadId) {
      const res = await fetch(`/api/clips/uploads/${opts.resumeUploadId}/resume`)
      const json = (await res.json()) as {
        data?: {
          uploadId: string
          bytes: number
          received: number
          storage: Awaited<ReturnType<typeof startUpload>>['storage']
          completedParts?: { partNumber: number; etag: string }[]
        }
      }
      if (!res.ok || !json.data || json.data.bytes !== file.size) {
        throw new Error('Cannot resume this upload — choose the same file or start again')
      }
      uploadId = json.data.uploadId
      resumeOffset = json.data.received
      storage = json.data.storage
      seedParts = json.data.completedParts ?? []
      if (resumeOffset >= file.size) {
        await completeUpload(uploadId, { durationMs: await probeDurationMs(file), parts: seedParts })
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
    if (!uploadId) throw new Error('Upload session missing')

    if (storage.mode === 'app_chunked') {
      throw new Error(
        'This upload session used deprecated server staging. Start a new upload — files go directly to object storage and resume after deploys.',
      )
    }

    let multipartParts: { partNumber: number; etag: string }[] | undefined

    if (storage.mode === 's3_multipart' && storage.s3Multipart) {
      multipartParts = await uploadS3Multipart(file, storage.s3Multipart, base, uploadId, onProgress, seedParts)
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
      await uploadTus(file, tusInfo, base, uploadId, onProgress)
    }

    await completeUpload(uploadId, { durationMs, parts: multipartParts })
    onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'complete' })
    return { uploadId }
  } catch (err) {
    const status = (err as { status?: number }).status
    const message = friendlyUploadError(err, status, { maxLabel })
    const retryable = isUploadErrorRetryable(err, status, message)
    const loaded = base.loaded
    onProgress({
      ...base,
      uploadId,
      loaded,
      percent: base.bytes ? Math.min(99, Math.round((loaded / base.bytes) * 100)) : 0,
      state: 'error',
      error: message,
      retryable,
    })
    throw err
  }
}

export async function cancelClipUpload(uploadId: string) {
  await abortUpload(uploadId)
}

/** Client preflight before starting upload (dropzone / file picker). */
export async function rejectFileIfOverUploadLimit(file: File): Promise<string | null> {
  const limits = await fetchUploadLimits()
  const effectiveMax = limits.effectiveMaxBytes ?? limits.maxBytes
  const maxLabel = limits.effectiveMaxLabel ?? limits.maxLabel
  if (file.size > effectiveMax) return uploadLimitExceededMessage(maxLabel)
  return null
}

export const multipartUploadFile = uploadClipFile
export const cancelMultipartUpload = cancelClipUpload
