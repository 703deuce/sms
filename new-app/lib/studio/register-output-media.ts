import 'server-only'

import type { ProjectMediaItem } from '@/lib/clips/editor/media-add'
import { registerProjectMedia } from '@/lib/server/clips/project-media'
import { getPrisma } from '@/lib/server/db'
import { storageDriverName } from '@/lib/storage/driver-name'
import { StudioError } from './errors'
import { getStudioJobForOutput, parseSourceVideoKind, type StudioService } from './jobs'

export async function registerStudioOutputForClip(
  svc: StudioService,
  input: { workspaceId: string; jobId: string; projectId: string; clipId: string },
): Promise<{ item: ProjectMediaItem; sourceRange: { startMs: number; endMs: number } }> {
  if (!input.projectId || !input.clipId) throw new StudioError('INVALID_PARAMS', 'projectId and clipId are required')
  if (!(await svc.store.clipInProject(input.workspaceId, input.projectId, input.clipId))) {
    throw new StudioError('INVALID_PARAMS', 'Clip was not found in this project')
  }

  const job = await getStudioJobForOutput(svc, input.workspaceId, input.jobId)
  if (job.projectId !== input.projectId) {
    throw new StudioError('INVALID_PARAMS', 'Generation belongs to a different project')
  }
  if (job.mode !== 'source_video_edit' || job.outputKind !== 'video' || !job.outputStorageKey || !job.outputContentType) {
    throw new StudioError('INVALID_PARAMS', 'Only completed source-video edits can replace a shot')
  }
  if (!job.sourceVideoAssetId) {
    throw new StudioError('INVALID_PARAMS', 'Generation is missing source-video provenance')
  }
  const sourceAsset = await svc.store.getAsset(input.workspaceId, job.sourceVideoAssetId)
  const sourceInfo = sourceAsset ? parseSourceVideoKind(sourceAsset.kind) : null
  if (!sourceInfo || sourceInfo.clipId !== input.clipId) {
    throw new StudioError('INVALID_PARAMS', 'Generation belongs to a different source clip')
  }

  const prisma = getPrisma()
  const uploadId = job.outputUploadId || `upl_${job.id}`
  const durationMs = Math.max(1000, Math.round((job.outputDurationSec ?? job.durationSec ?? 2) * 1000))
  const existing = await prisma.clipUpload.findUnique({
    where: { id: uploadId },
    select: { workspaceId: true, key: true },
  })
  if (existing && (existing.workspaceId !== input.workspaceId || existing.key !== job.outputStorageKey)) {
    throw new StudioError('STORAGE_ERROR', 'Generated media upload id is already in use')
  }
  if (!existing) {
    await prisma.clipUpload.create({
      data: {
        id: uploadId,
        workspaceId: input.workspaceId,
        key: job.outputStorageKey,
        filename: `ai-shot-edit-${job.id}.mp4`,
        bytes: BigInt(1),
        mime: job.outputContentType,
        status: 'COMPLETE',
        durationMs,
        width: job.outputWidth,
        height: job.outputHeight,
        storageDriver: job.outputStorageDriver || storageDriverName(),
        kind: 'media',
      },
    })
  }
  if (!job.outputUploadId) {
    await svc.store.updateJob(job.id, { outputUploadId: uploadId })
  }

  const item = await registerProjectMedia(input.workspaceId, input.projectId, {
    uploadId,
    label: 'AI shot edit',
    durationMs,
    width: job.outputWidth ?? undefined,
    height: job.outputHeight ?? undefined,
  })
  if (!item) throw new StudioError('PROJECT_NOT_FOUND', 'Project not found')
  console.info('[editor:generate-mode] candidate-media-ready', {
    jobId: job.id,
    clipId: input.clipId,
    uploadId,
    durationMs,
  })
  return {
    item,
    sourceRange: { startMs: sourceInfo.startMs, endMs: sourceInfo.endMs },
  }
}
