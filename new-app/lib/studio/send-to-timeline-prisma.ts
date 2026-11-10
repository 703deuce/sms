import { defaultEdits } from '../clips/edits'
import { registerProjectMedia } from '../server/clips/project-media'
import { toPrismaJson } from '../server/clips/prisma-json'
import { getPrisma } from '../server/db'
import { createId } from '../supabase/id'
import { storageDriverName } from '../storage/driver-name'
import { StudioError } from './errors'
import type { TimelineWriter } from './send-to-timeline'

export const defaultTimelineWriter: TimelineWriter = async (input) => {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: input.projectId, workspaceId: input.workspaceId, deletedAt: null },
    select: { id: true, uploadId: true },
  })
  if (!project) throw new StudioError('PROJECT_NOT_FOUND', 'Project not found')

  const ext = input.contentType.includes('png')
    ? 'png'
    : input.contentType.includes('jpeg') || input.contentType.includes('jpg')
      ? 'jpg'
      : input.contentType.includes('webp')
        ? 'webp'
        : 'mp4'
  const uploadId = createId('upl')
  const durationMs = Math.max(input.kind === 'image' ? 3000 : input.durationMs || 1000, 500)
  await prisma.clipUpload.create({
    data: {
      id: uploadId,
      workspaceId: input.workspaceId,
      key: input.storageKey,
      filename: `${input.title || 'studio-output'}.${ext}`,
      bytes: BigInt(1),
      mime: input.contentType,
      status: 'COMPLETE',
      durationMs,
      width: input.width,
      height: input.height,
      storageDriver: input.storageDriver || storageDriverName(),
      kind: 'media',
    },
  })

  try {
    await registerProjectMedia(input.workspaceId, input.projectId, {
      uploadId,
      label: input.title,
      durationMs,
      width: input.width ?? undefined,
      height: input.height ?? undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to add media to the project'
    if (/already the main video/i.test(message)) {
      // Still create a clip below; the file is already the project's source.
    } else {
      throw new StudioError('STORAGE_ERROR', message)
    }
  }

  const clipId = createId('clip')
  const edits = defaultEdits({ clipStartMs: 0, clipEndMs: durationMs, trimMinMs: 0, trimMaxMs: durationMs })
  await prisma.clip.create({
    data: {
      id: clipId,
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      title: (input.title || 'Studio output').slice(0, 120),
      reason: 'ai_studio',
      startMs: 0,
      endMs: durationMs,
      previewKey: input.kind === 'image' ? input.storageKey : null,
      posterKey: input.kind === 'image' ? input.storageKey : null,
      storageDriver: input.storageDriver || storageDriverName(),
      sourceSegKey: input.kind === 'video' ? input.storageKey : null,
      sourceSegStartMs: input.kind === 'video' ? 0 : null,
      sourceSegEndMs: input.kind === 'video' ? durationMs : null,
      edits: toPrismaJson(edits),
      aiMeta: toPrismaJson({ studioJobId: input.jobId, sourceUploadId: uploadId, targetClipId: input.targetClipId || undefined }),
    },
  })
  return { ok: true, projectId: input.projectId, clipId }
}
