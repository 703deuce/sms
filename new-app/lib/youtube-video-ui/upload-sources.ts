import { createProject } from '../clips-api'
import { defaultClipSettings } from '../clips/settings'
import { uploadClipFile, type UploadProgress } from '../clips/upload'
import type { YoutubeVideoUploadSource } from '../youtube-video/types'

/** Reuse the existing project-creating upload flow for each file. */
export async function uploadFileToProject(
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<YoutubeVideoUploadSource> {
  const { uploadId } = await uploadClipFile(file, onProgress ?? (() => {}), { kind: 'media' })
  const title = file.name.replace(/\.[^.]+$/, '') || file.name
  const project = await createProject({
    uploadId,
    title,
    settings: defaultClipSettings(),
  })
  return { kind: 'upload', projectId: project.id }
}
