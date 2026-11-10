import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

const CARD_ASPECTS = new Set(['9:16', '16:9', '4:5', '1:1'])

function resolveCardAspect(edits: unknown, settings: unknown): string {
  const editRecord = edits && typeof edits === 'object' && !Array.isArray(edits)
    ? edits as Record<string, unknown> : {}
  const settingsRecord = settings && typeof settings === 'object' && !Array.isArray(settings)
    ? settings as Record<string, unknown> : {}
  const raw = typeof editRecord.aspectRatio === 'string'
    ? editRecord.aspectRatio
    : typeof settingsRecord.aspectRatio === 'string'
      ? settingsRecord.aspectRatio
      : '9:16'
  return CARD_ASPECTS.has(raw) ? raw : '9:16'
}

export async function enqueueClipCardThumbnail(
  workspaceId: string,
  clipId: string,
  reason: 'agent_publish' | 'page_load_backfill',
): Promise<boolean> {
  const started = Date.now()
  console.info('[clips:cards] thumbnail backfill begin', { clipId, reason })
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      posterKey: true,
      edits: true,
      project: { select: { settings: true } },
    },
  })
  if (!clip) {
    console.info('[clips:cards] thumbnail backfill end', {
      clipId, reason, queued: false, skip: 'missing', elapsedMs: Date.now() - started,
    })
    return false
  }
  if (clip.posterKey) {
    console.info('[clips:cards] thumbnail backfill end', {
      clipId, reason, queued: false, skip: 'exists', elapsedMs: Date.now() - started,
    })
    return false
  }
  const active = await prisma.clipJob.findFirst({
    where: { clipId, type: 'CARD_THUMBNAIL', status: { in: ['QUEUED', 'RUNNING'] } },
    select: { id: true },
  })
  if (active) {
    console.info('[clips:cards] thumbnail backfill end', {
      clipId, reason, queued: false, skip: 'active', elapsedMs: Date.now() - started,
    })
    return false
  }
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: clip.projectId,
      clipId,
      type: 'CARD_THUMBNAIL',
      status: 'QUEUED',
      payload: {
        clipId,
        aspect: resolveCardAspect(clip.edits, clip.project.settings),
        reason,
      },
    },
  })
  console.info('[clips:cards] thumbnail backfill end', {
    clipId, reason, jobId, queued: true, elapsedMs: Date.now() - started,
  })
  return true
}
