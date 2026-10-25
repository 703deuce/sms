import * as tus from 'tus-js-client'
import { abortUpload, completeUpload, startUpload } from '@/lib/clips-api'

export type UploadProgress = {
  filename: string
  bytes: number
  loaded: number
  percent: number
  state: 'idle' | 'uploading' | 'complete' | 'error' | 'canceled'
  error?: string
  uploadId?: string
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

export async function uploadClipFile(
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
  const { uploadId, storage } = started
  const durationMs = await probeDurationMs(file)

  if (storage.mode === 's3_multipart' && storage.s3Multipart) {
    throw new Error('S3 multipart client path not enabled in browser; set STORAGE_DRIVER=supabase')
  }

  const tusInfo = storage.tus
  if (!tusInfo) throw new Error('Missing upload authorization')

  if (storage.mode === 'signed_put' && storage.signedPut && file.size <= 50 * 1024 * 1024) {
    const res = await fetch(storage.signedPut.url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${storage.signedPut.token}`,
        'Content-Type': file.type || 'video/mp4',
        'x-upsert': 'false',
      },
      body: file,
    })
    if (!res.ok) throw new Error(`Upload failed (${res.status})`)
    onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'uploading' })
  } else {
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
            percent: Math.min(100, Math.round((sent / total) * 100)),
            state: 'uploading',
          })
        },
        onSuccess: () => resolve(),
      })
      upload.start()
    })
  }

  await completeUpload(uploadId, { durationMs })
  onProgress({ ...base, uploadId, loaded: file.size, percent: 100, state: 'complete' })
  return { uploadId }
}

export async function cancelClipUpload(uploadId: string) {
  await abortUpload(uploadId)
}

// Back-compat export name
export const multipartUploadFile = uploadClipFile
export const cancelMultipartUpload = cancelClipUpload
