import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { withAutoContentDetection } from '@/lib/clips/content-detection'
import { clipProjectSettingsSchema, defaultClipSettings } from '@/lib/clips/settings'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { projectWordsKey } from '@/lib/storage'

/**
 * FV1 "Find clips in this video": a normal clip-finding project over the same upload. The full
 * video's transcript is copied onto the new project, so the worker's resume path
 * (resolve_transcript_for_job) skips ASR — no second transcription. The 720p playback proxy (if the
 * full-video job made one) is shared by key; no new storage objects are created here.
 */
export async function createFindClipsProjectFromFullVideo(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const src = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!src) return null
  if (!isFullVideoSettings(src.settings)) throw new Error('Only full-video projects can start clip finding here')
  if (!src.uploadId) throw new Error('This video has no upload to find clips in')
  const upload = await prisma.clipUpload.findFirst({ where: { id: src.uploadId, workspaceId, status: 'COMPLETE' } })
  if (!upload) throw new Error('Upload not complete')

  const prev = clipProjectSettingsSchema.safeParse(src.settings)
  const keep = prev.success ? prev.data : defaultClipSettings()
  // Clip-finding defaults (vertical shorts), keeping the user's captions + brand choices.
  const settings = withAutoContentDetection(
    defaultClipSettings({
      captions: keep.captions,
      brandTemplateId: keep.brandTemplateId,
      brand: keep.brand,
      rangeStartMs: 0,
      rangeEndMs: upload.durationMs || src.rangeEndMs || 0,
    }),
  )
  const newId = createId('proj')
  const transcriptWords = Array.isArray(src.transcriptWords) && src.transcriptWords.length ? src.transcriptWords : undefined
  const project = await prisma.clipProject.create({
    data: {
      id: newId,
      workspaceId,
      title: `${src.title} · clips`.slice(0, 200),
      uploadId: upload.id,
      settings: JSON.parse(JSON.stringify(settings)),
      rangeStartMs: settings.rangeStartMs,
      rangeEndMs: settings.rangeEndMs,
      status: 'QUEUED',
      stage: 'queued',
      progress: 0,
      transcriptKey: projectWordsKey(workspaceId, newId),
      ...(transcriptWords ? { transcriptWords: JSON.parse(JSON.stringify(transcriptWords)) } : {}),
      ...(src.proxyKey ? { proxyKey: src.proxyKey } : {}),
      ...(src.folderId ? { folderId: src.folderId } : {}),
    },
  })
  await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId: project.id,
      type: 'PROCESS_PROJECT',
      status: 'QUEUED',
      payload: toPrismaJson(buildProcessProjectJobPayload(settings, { fromFullVideo: src.id })),
    },
  })
  return project
}
