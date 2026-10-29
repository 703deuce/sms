import 'server-only'

import { createId } from '@/lib/supabase/id'
import { defaultEdits, normalizeEdits, type ClipBounds } from '@/lib/clips/edits'
import { clampTrimToExtendedBounds } from '@/lib/clips/trim-bounds'
import { clipBoundsForPatch } from '@/lib/server/clips/clip-patch-bounds'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'

export type DeriveClipInput = {
  trimIn: number
  trimOut: number
  title?: string
}

export async function deriveClipFromSelection(
  workspaceId: string,
  parentClipId: string,
  input: DeriveClipInput,
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
  const trim = clampTrimToExtendedBounds(
    bounds.clipStartMs,
    bounds.clipEndMs,
    { in: input.trimIn, out: input.trimOut },
    bounds.trimMinMs != null && bounds.trimMaxMs != null
      ? { minMs: bounds.trimMinMs, maxMs: bounds.trimMaxMs }
      : undefined,
  )
  if (trim.out - trim.in < 500) {
    throw new Error('Selection is too short for a new clip')
  }

  const newBounds: ClipBounds = { clipStartMs: trim.in, clipEndMs: trim.out }
  const parentEdits = normalizeEdits(parent.edits, bounds)
  const childEdits = normalizeEdits(
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

  const prisma = getPrisma()
  const childId = createId('clip')
  const title =
    input.title?.trim().slice(0, 120) ||
    `${parent.title.slice(0, 80)} (${Math.round((trim.out - trim.in) / 1000)}s)`

  await prisma.clip.create({
    data: {
      id: childId,
      workspaceId,
      projectId: parent.projectId,
      title,
      reason: 'derived',
      startMs: trim.in,
      endMs: trim.out,
      score: parent.score,
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
      aiMeta: toPrismaJson({
        ...(typeof parent.aiMeta === 'object' && parent.aiMeta ? parent.aiMeta : {}),
        derivedFromClipId: parentClipId,
      }),
    },
  })

  return { clipId: childId, projectId: parent.projectId, edits: childEdits }
}
