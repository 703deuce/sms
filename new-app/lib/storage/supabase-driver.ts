import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Readable } from 'node:stream'
import type { ClipStorageDriver, CompleteUploadInput, CreateUploadInput, CreateUploadResult } from '@/lib/storage/types'
import { CLIPS_APP_CHUNK_BYTES, shouldUseAppChunkedUpload } from '@/lib/server/clips/upload-limits'

const TUS_CHUNK_BYTES = 6 * 1024 * 1024
const SIGNED_PUT_MAX_BYTES = 50 * 1024 * 1024

function config() {
  const url = (process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '').replace(/\/$/, '')
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const bucket = process.env.STORAGE_BUCKET?.trim() || process.env.CLIPS_STORAGE_BUCKET?.trim() || 'clips'
  if (!url || !key) return null
  return { url, key, bucket }
}

function client() {
  const c = config()
  if (!c) throw new Error('Supabase storage is not configured')
  return { supabase: createClient(c.url, c.key, { auth: { persistSession: false } }), ...c }
}

export function getSupabaseStorageConfig() {
  return config()
}

export function createSupabaseStorageDriver(): ClipStorageDriver {
  return {
    name: 'supabase',
    async createUpload(input: CreateUploadInput): Promise<CreateUploadResult> {
      const { url, bucket } = client()
      if (shouldUseAppChunkedUpload(input.bytes)) {
        return {
          mode: 'app_chunked',
          appChunked: {
            chunkBytes: CLIPS_APP_CHUNK_BYTES,
            chunkUrl: `/api/clips/uploads/${input.uploadId}/chunk`,
          },
        }
      }
      const { supabase } = client()
      const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(input.objectKey, {
        upsert: false,
      })
      if (error || !data) throw new Error(error?.message || 'createSignedUploadUrl failed')

      const tusEndpoint = `${url}/storage/v1/upload/resumable`
      if (input.bytes <= SIGNED_PUT_MAX_BYTES) {
        return {
          mode: 'signed_put',
          signedPut: { url: data.signedUrl, token: data.token },
          tus: {
            endpoint: tusEndpoint,
            bucket,
            objectKey: input.objectKey,
            token: data.token,
          },
        }
      }
      return {
        mode: 'tus',
        tus: {
          endpoint: tusEndpoint,
          bucket,
          objectKey: input.objectKey,
          token: data.token,
        },
      }
    },
    async completeUpload(input: CompleteUploadInput): Promise<void> {
      const { supabase, bucket } = client()
      const { error } = await supabase.storage.from(bucket).download(input.objectKey)
      if (error) throw new Error(error.message || 'Upload not found in storage')
    },
    async abortUpload(input: { objectKey: string }): Promise<void> {
      const { supabase, bucket } = client()
      await supabase.storage.from(bucket).remove([input.objectKey])
    },
    async putBytes(objectKey: string, body: Buffer, contentType: string): Promise<void> {
      const { supabase, bucket } = client()
      const { error } = await supabase.storage.from(bucket).upload(objectKey, body, {
        contentType,
        upsert: true,
      })
      if (error) throw new Error(error.message)
    },
    async putStream(objectKey: string, stream: Readable, contentType: string): Promise<void> {
      const { supabase, bucket } = client()
      const { error } = await supabase.storage.from(bucket).upload(objectKey, stream, {
        contentType,
        upsert: true,
        duplex: 'half',
      })
      if (error) throw new Error(error.message)
    },
    async putJson(objectKey: string, data: unknown): Promise<void> {
      const { supabase, bucket } = client()
      const body = JSON.stringify(data)
      const { error } = await supabase.storage.from(bucket).upload(objectKey, body, {
        contentType: 'application/json',
        upsert: true,
      })
      if (error) throw new Error(error.message)
    },
    async getJson<T>(objectKey: string): Promise<T> {
      const { supabase, bucket } = client()
      const { data, error } = await supabase.storage.from(bucket).download(objectKey)
      if (error || !data) throw new Error(error?.message || 'download failed')
      const text = await data.text()
      return JSON.parse(text) as T
    },
    async createSignedDownloadUrl(
      objectKey: string,
      expiresInSec: number,
      options?: { downloadFilename?: string },
    ): Promise<string> {
      const { supabase, bucket } = client()
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectKey, expiresInSec, {
        download: options?.downloadFilename ?? false,
      })
      if (error || !data?.signedUrl) throw new Error(error?.message || 'signed download failed')
      return data.signedUrl
    },
    async getObjectSizeBytes(objectKey: string): Promise<number | null> {
      const { supabase, bucket } = client()
      const parts = objectKey.split('/')
      const name = parts.pop()
      const folder = parts.join('/')
      if (!name) return null
      const { data, error } = await supabase.storage.from(bucket).list(folder, { search: name, limit: 1 })
      if (error || !data?.length) return null
      const row = data.find((r) => r.name === name) ?? data[0]
      const meta = row.metadata as { size?: number } | undefined
      return typeof meta?.size === 'number' ? meta.size : null
    },
  }
}

export { TUS_CHUNK_BYTES, SIGNED_PUT_MAX_BYTES }
