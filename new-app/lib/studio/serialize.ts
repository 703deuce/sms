import type { StudioAspect, StudioJob, StudioJobRecord, StudioMode } from './types'

export function studioOutputUrls(jobId: string): { previewUrl: string; downloadUrl: string } {
  const path = `/api/studio/jobs/${jobId}/output`
  return { previewUrl: path, downloadUrl: `${path}?download=1` }
}

export function serializeStudioJob(row: StudioJobRecord): StudioJob {
  const urls = studioOutputUrls(row.id)
  const output =
    row.status === 'done' && row.outputKind && row.outputContentType
      ? {
          kind: row.outputKind,
          contentType: row.outputContentType,
          width: row.outputWidth,
          height: row.outputHeight,
          durationSec: row.outputDurationSec,
          previewUrl: urls.previewUrl,
          downloadUrl: urls.downloadUrl,
        }
      : null
  return {
    id: row.id,
    status: row.status,
    modelId: row.modelId,
    mode: row.mode as StudioMode,
    prompt: row.prompt,
    aspect: (row.aspect as StudioAspect | null) ?? null,
    durationSec: row.durationSec,
    resolution: row.resolution,
    creditEstimate: row.creditEstimate,
    projectId: row.projectId,
    output,
    error:
      row.errorCode && row.errorMessage
        ? { code: row.errorCode, message: row.errorMessage }
        : row.status === 'failed' && row.errorMessage
          ? { code: row.errorCode || 'KIE_ERROR', message: row.errorMessage }
          : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
  }
}
