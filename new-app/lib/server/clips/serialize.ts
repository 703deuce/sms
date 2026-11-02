import type { ClipProject, ClipUpload } from '@prisma/client'
import { clipperCapabilities } from '@/lib/server/clips/clipper-capabilities'

export function serializeUpload(row: ClipUpload) {
  return {
    id: row.id,
    filename: row.filename,
    bytes: row.bytes.toString(),
    mime: row.mime,
    durationMs: row.durationMs,
    width: row.width,
    height: row.height,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  }
}

export function serializeProject(row: Pick<ClipProject, 'id' | 'title' | 'status' | 'stage' | 'progress' | 'error' | 'rangeStartMs' | 'rangeEndMs' | 'uploadId' | 'transcriptKey' | 'createdAt' | 'updatedAt'> & {
  settings?: ClipProject['settings']
  transcriptWords?: ClipProject['transcriptWords']
}) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    stage: row.stage,
    progress: row.progress,
    error: row.error,
    settings: row.settings ?? {},
    rangeStartMs: row.rangeStartMs,
    rangeEndMs: row.rangeEndMs,
    uploadId: row.uploadId,
    transcriptKey: row.transcriptKey,
    hasTranscript: Boolean(row.transcriptKey ?? row.transcriptWords),
    wordCount:
      row.transcriptWords != null && Array.isArray(row.transcriptWords)
        ? (row.transcriptWords as unknown[]).length
        : 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    capabilities: clipperCapabilities(),
  }
}
