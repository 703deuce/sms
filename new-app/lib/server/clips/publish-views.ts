import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'

export type PublishViewEventDto = { at: string; label?: string }

export async function listPublishViewEvents(publishId: string, limit = 50): Promise<PublishViewEventDto[]> {
  const prisma = getPrisma()
  const rows = await prisma.scriptCompositionPublishView.findMany({
    where: { publishId },
    orderBy: { lastViewedAt: 'desc' },
    take: limit,
    select: { lastViewedAt: true, viewerLabel: true },
  })
  return rows.map((r) => ({
    at: r.lastViewedAt.toISOString(),
    label: r.viewerLabel?.trim() || undefined,
  }))
}

/**
 * Record one view per viewer session. Returns whether this session was newly counted.
 */
export async function recordPublishView(input: {
  publishId: string
  compositionId: string
  workspaceId: string
  viewerSessionKey: string
  viewerUserId?: string | null
  viewerLabel?: string | null
}): Promise<{ counted: boolean; viewCount: number }> {
  const prisma = getPrisma()
  const existing = await prisma.scriptCompositionPublishView.findUnique({
    where: {
      publishId_viewerSessionKey: {
        publishId: input.publishId,
        viewerSessionKey: input.viewerSessionKey,
      },
    },
    select: { id: true },
  })

  if (existing) {
    await prisma.scriptCompositionPublishView.update({
      where: { id: existing.id },
      data: { lastViewedAt: new Date() },
    })
    const pub = await prisma.scriptCompositionPublish.findUnique({
      where: { id: input.publishId },
      select: { viewCount: true },
    })
    return { counted: false, viewCount: pub?.viewCount ?? 0 }
  }

  await prisma.$transaction([
    prisma.scriptCompositionPublishView.create({
      data: {
        id: createId('spvw'),
        publishId: input.publishId,
        compositionId: input.compositionId,
        workspaceId: input.workspaceId,
        viewerSessionKey: input.viewerSessionKey,
        viewerUserId: input.viewerUserId ?? null,
        viewerLabel: input.viewerLabel?.trim() || null,
      },
    }),
    prisma.scriptCompositionPublish.update({
      where: { id: input.publishId },
      data: { viewCount: { increment: 1 } },
    }),
  ])

  const pub = await prisma.scriptCompositionPublish.findUnique({
    where: { id: input.publishId },
    select: { viewCount: true },
  })
  return { counted: true, viewCount: pub?.viewCount ?? 0 }
}
