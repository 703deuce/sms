import 'server-only'

import { createId } from '@/lib/supabase/id'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { findClipSettingsFor } from '@/lib/server/clips/full-video-projects'
import { deriveClipFromSelection } from '@/lib/server/clips/derive-clip'
import { getPrisma } from '@/lib/server/db'
import { projectWordsKey } from '@/lib/storage'
import type { ReasonTag } from '@/lib/clips/reason-tag'

export type MakeClipFromRangeInput = {
  startMs: number
  endMs: number
  title?: string
  reasonTag?: ReasonTag
  score?: number
  why?: string
  findJobId?: string
}

export async function ensureSiblingClipsProject(workspaceId: string, fvProjectId: string) {
  const prisma = getPrisma()
  const fv = await prisma.clipProject.findFirst({
    where: { id: fvProjectId, workspaceId, deletedAt: null },
    select: { id: true, title: true, uploadId: true, settings: true, transcriptWords: true, proxyKey: true, folderId: true },
  })
  if (!fv || !isFullVideoSettings(fv.settings) || !fv.uploadId) {
    throw new Error('Full-video project required')
  }
  const upload = await prisma.clipUpload.findFirst({
    where: { id: fv.uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upload) throw new Error('Upload not complete')

  const siblings = await prisma.clipProject.findMany({
    where: { workspaceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, settings: true },
  })
  const existing = siblings.find((p) => {
    const s = p.settings as { fromFullVideoProjectId?: string }
    return s?.fromFullVideoProjectId === fvProjectId
  })
  if (existing) return existing.id

  const settings = findClipSettingsFor(fv, upload)
  const transcriptWords =
    Array.isArray(fv.transcriptWords) && fv.transcriptWords.length ? fv.transcriptWords : undefined
  const newId = createId('proj')
  await prisma.clipProject.create({
    data: {
      id: newId,
      workspaceId,
      title: `${fv.title} · clips`.slice(0, 200),
      uploadId: upload.id,
      settings: JSON.parse(JSON.stringify(settings)),
      rangeStartMs: settings.rangeStartMs,
      rangeEndMs: settings.rangeEndMs,
      status: 'READY',
      stage: 'ready',
      progress: 100,
      transcriptKey: projectWordsKey(workspaceId, newId),
      ...(transcriptWords ? { transcriptWords: JSON.parse(JSON.stringify(transcriptWords)) } : {}),
      ...(fv.proxyKey ? { proxyKey: fv.proxyKey } : {}),
      ...(fv.folderId ? { folderId: fv.folderId } : {}),
    },
  })
  return newId
}

export async function makeClipFromFullVideoRange(
  workspaceId: string,
  fvProjectId: string,
  input: MakeClipFromRangeInput,
) {
  const prisma = getPrisma()
  const parentClip = await prisma.clip.findFirst({
    where: { projectId: fvProjectId, workspaceId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!parentClip) throw new Error('Full-video clip missing')

  const targetProjectId = await ensureSiblingClipsProject(workspaceId, fvProjectId)
  const aiMeta: Record<string, unknown> = {}
  if (input.reasonTag) aiMeta.reasonTag = input.reasonTag
  if (input.why) aiMeta.why = input.why
  if (input.findJobId) aiMeta.fromFindJobId = input.findJobId

  return deriveClipFromSelection(
    workspaceId,
    parentClip.id,
    {
      trimIn: input.startMs,
      trimOut: input.endMs,
      title: input.title,
    },
    {
      targetProjectId,
      score: input.score,
      aiMeta,
    },
  )
}
