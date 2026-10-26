import 'server-only'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { supabaseObjectMaxBytes } from '@/lib/server/clips/upload-limits'

export const STAGING_KEY_PREFIX = '@staging/'

export function clipsUploadStagingRoot(): string {
  return (
    process.env.CLIPS_UPLOAD_STAGING_DIR?.trim() ||
    process.env.CLIPS_UPLOAD_STAGING_ROOT?.trim() ||
    '/opt/clips-upload-staging'
  )
}

export function isStagingObjectKey(key: string): boolean {
  return key.startsWith(STAGING_KEY_PREFIX)
}

export function stagingObjectKey(uploadId: string): string {
  return `${STAGING_KEY_PREFIX}${uploadId}`
}

export function shouldStoreUploadOnStaging(bytes: number): boolean {
  if (process.env.CLIPS_FORCE_SUPABASE_UPLOAD?.trim() === '1') return false
  return bytes > supabaseObjectMaxBytes()
}

export async function finalizeStagingUpload(uploadId: string, ext: string, fromChunkPath: string): Promise<string> {
  const root = clipsUploadStagingRoot()
  await fsp.mkdir(root, { recursive: true })
  const dest = path.join(root, `${uploadId}.${ext}`)
  await fsp.rename(fromChunkPath, dest).catch(async () => {
    await fsp.copyFile(fromChunkPath, dest)
    await fsp.unlink(fromChunkPath).catch(() => {})
  })
  return stagingObjectKey(uploadId)
}

export function stagingFilePath(uploadId: string, ext: string): string {
  return path.join(clipsUploadStagingRoot(), `${uploadId}.${ext}`)
}
