import type { Readable } from 'stream'

export type StorageDriverName = 'supabase' | 's3'

export type CreateUploadInput = {
  workspaceId: string
  uploadId: string
  filename: string
  bytes: number
  mime: string
  objectKey: string
}

export type CreateUploadResult = {
  mode: 'tus' | 'signed_put' | 's3_multipart' | 'app_chunked'
  /** Resumable upload through the web app (bypasses Supabase TUS limits). */
  appChunked?: {
    chunkBytes: number
    chunkUrl: string
  }
  /** For TUS resumable (Supabase). */
  tus?: {
    endpoint: string
    bucket: string
    objectKey: string
    token: string
  }
  /** Direct PUT for smaller files. */
  signedPut?: {
    url: string
    token: string
  }
  /** Legacy S3 multipart. */
  s3Multipart?: {
    uploadId: string
    partSize: number
    partUrls: { partNumber: number; url: string }[]
  }
}

export type CompleteUploadInput = {
  objectKey: string
  s3UploadId?: string | null
  parts?: { partNumber: number; etag: string }[]
}

export interface ClipStorageDriver {
  name: StorageDriverName
  createUpload(input: CreateUploadInput): Promise<CreateUploadResult>
  completeUpload(input: CompleteUploadInput): Promise<void>
  abortUpload(input: { objectKey: string; s3UploadId?: string | null }): Promise<void>
  putJson(objectKey: string, data: unknown): Promise<void>
  putBytes(objectKey: string, body: Buffer, contentType: string): Promise<void>
  putStream(objectKey: string, body: Readable, contentType: string): Promise<void>
  getJson<T>(objectKey: string): Promise<T>
  createSignedDownloadUrl(
    objectKey: string,
    expiresInSec: number,
    options?: { downloadFilename?: string },
  ): Promise<string>
  getObjectSizeBytes(objectKey: string): Promise<number | null>
  /** ETag or size token for stable presigned URL caching. */
  getObjectVersionToken?(objectKey: string): Promise<string>
}
