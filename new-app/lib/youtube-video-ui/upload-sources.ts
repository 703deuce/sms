import { clipsFetch } from '../clips-api'
import { uploadClipFile, type UploadProgress } from '../clips/upload'
import type { YoutubeVideoUploadSource } from '../youtube-video/types'

/** Upload normally, then create a dedicated transcription-only source project. */
export async function uploadFileToProject(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<YoutubeVideoUploadSource> {
  const { uploadId } = await uploadClipFile(file, onProgress ?? (() => {}), { kind: 'media' })
  const project = await clipsFetch<{ projectId: string }>('/api/youtube-video/sources', {
    method: 'POST',
    body: JSON.stringify({ uploadId }),
  })
  return { kind: 'upload', projectId: project.projectId }
}
