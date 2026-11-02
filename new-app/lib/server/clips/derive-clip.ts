import 'server-only'

import { createId } from '@/lib/supabase/id'
import { defaultEdits, normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { snapClipBoundsMs, snapWordsFromTranscriptRaw } from '@/lib/clips/editor/snap-clip-bounds'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import { lightAutoEdit } from '@/lib/clips/light-auto-edit'
import { clipProjectSettingsSchema } from '@/lib/clips/settings'

export type DeriveClipInput = {
  trimIn: number
  trimOut: number
  title?: string
}

export async function deriveClipFromSelection(
  workspaceId: string,
  parentClipId: string,
  input: DeriveClipInput,
  opts?: { targetProjectId?: string; score?: number; aiMeta?: Record<string, unknown> },
) {
  const parent = await getClipForWorkspace(workspaceId, parentClipId)
  if (!parent) return null

  if (input.trimOut <= input.trimIn) {
    throw new Error('trimOut must be after trimIn')
  }
  if (input.trimOut - input.trimIn < 500) {
    throw new Error('Selection is too short for a new clip')
  }

  const bounds = await clipBoundsForPatch(parent)
  let trimIn = input.trimIn
  let trimOut = input.trimOut
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({
    where: { id: parent.projectId, workspaceId },
    select: {
      transcriptKey: true,
      transcriptWords: true,
      settings: true,
      upload: { select: { storageDriver: true } },
    },
  })
  const storageDriverHint = parent.storageDriver ?? project?.upload?.storageDriver ?? null
  if (project?.transcriptKey || project?.transcriptWords) {
    try {
      let raw = project.transcriptWords
      if (project.transcriptKey) {
        const storage = await getClipStorageForObjectKey(project.transcriptKey, storageDriverHint)
        raw = (await storage.getJson(project.transcriptKey)) as unknown
      }
      let words = snapWordsFromTranscriptRaw(raw)
      if (!words.some((w) => w.w.trim()) && project.transcriptWords && project.transcriptKey) {
        words = snapWordsFromTranscriptRaw(project.transcriptWords)
      }
      const rangeStart = bounds.trimMinMs ?? bounds.clipStartMs
      const rangeEnd = bounds.trimMaxMs ?? bounds.clipEndMs
      const snapped = snapClipBoundsMs({ startMs: trimIn, endMs: trimOut }, words, rangeStart, rangeEnd)
      trimIn = snapped.startMs
      trimOut = snapped.endMs
    } catch {
      /* optional snap */
    }
  }

  const trim = clampTrimToExtendedBounds(
    bounds.clipStartMs,
    bounds.clipEndMs,
    { in: trimIn, out: trimOut },
    bounds.trimMinMs != null && bounds.trimMaxMs != null
      ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
      : undefined,
  )
  if (trim.out - trim.in < 500) {
    throw new Error('Selection is too short for a new clip')
  }

  const newBounds: ClipBounds = { clipStartMs: trim.in, clipEndMs: trim.out }
  const parentEdits = normalizeEdits(parent.edits, bounds)
  const projectSettings = clipProjectSettingsSchema.safeParse(project?.settings)
  let childEdits = normalizeEdits(
    {
      ...defaultEdits(newBounds),
      captions: parentEdits.captions,
      layout: parentEdits.layout,
      aspectRatio: parentEdits.aspectRatio,
      trim,
      cutRanges: [],
    },
    newBounds,
  )
  if (projectSettings.success) {
    childEdits = lightAutoEdit(childEdits, { autoZoom: projectSettings.data.autoZoom })
  }

  const childId = createId('clip')
  const title =
    input.title?.trim().slice(0, 120) ||
    `${parent.title.slice(0, 80)} (${Math.round((trim.out - trim.in) / 1000)}s)`

  let targetProjectId = parent.projectId
  if (opts?.targetProjectId) {
    const target = await prisma.clipProject.findFirst({
      where: { id: opts.targetProjectId, workspaceId, deletedAt: null },
      select: { id: true, uploadId: true },
    })
    if (!target) throw new Error('Target project not found')
    const parentProject = await prisma.clipProject.findFirst({
      where: { id: parent.projectId, workspaceId },
      select: { uploadId: true },
    })
    if (!parentProject?.uploadId || target.uploadId !== parentProject.uploadId) {
      throw new Error('Target project must share the same upload')
    }
    targetProjectId = target.id
  }

  const childScore = opts?.score ?? parent.score
  const aiMetaOut = {
    ...(typeof parent.aiMeta === 'object' && parent.aiMeta ? parent.aiMeta : {}),
    derivedFromClipId: parentClipId,
    ...(opts?.aiMeta ?? {}),
  }

  await prisma.clip.create({
    data: {
      id: childId,
      workspaceId,
      projectId: targetProjectId,
      title,
      reason: 'derived',
      startMs: trim.in,
      endMs: trim.out,
      score: childScore,
      scores: parent.scores ?? {},
      cropKey: parent.cropKey,
      wordsKey: parent.wordsKey,
      previewKey: null,
      posterKey: parent.posterKey,
      storageDriver: parent.storageDriver,
      sourceSegKey: parent.sourceSegKey,
      sourceSegStartMs: parent.sourceSegStartMs,
      sourceSegEndMs: parent.sourceSegEndMs,
      edits: toPrismaJson(childEdits),
      aiMeta: toPrismaJson(aiMetaOut),
    },
  })

  return { clipId: childId, projectId: targetProjectId, edits: childEdits }
}
