/** Streamer dropzone: same file resumes TUS; a different file replaces a stale entry. */

export type PendingUploadMeta = {
  uploadId: string
  filename: string
  bytes: number
  lastModified?: number
}

export function fileMatchesResume(file: File, saved: PendingUploadMeta): boolean {
  if (file.name !== saved.filename) return false
  if (file.size !== saved.bytes) return false
  if (saved.lastModified != null && file.lastModified !== saved.lastModified) return false
  return true
}

export function streamerUploadResumeAction(
  file: File,
  saved: PendingUploadMeta | null,
): 'resume' | 'replace_stale' {
  if (!saved) return 'replace_stale'
  return fileMatchesResume(file, saved) ? 'resume' : 'replace_stale'
}
