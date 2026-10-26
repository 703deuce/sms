import 'server-only'
import path from 'node:path'

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

/** @deprecated Local disk staging is not shared with workers; always upload to object storage. */
export function shouldStoreUploadOnStaging(_bytes: number): boolean {
  return false
}

export function stagingFilePath(uploadId: string, ext: string): string {
  return path.join(clipsUploadStagingRoot(), `${uploadId}.${ext}`)
}
