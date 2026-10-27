import { getPrisma } from '@/lib/server/db'

export type StreamFeedbackKind = 'thumbs_down' | 'download' | 'export'

/** Persist clip/channel feedback features for future per-channel tuning (store only). */
export async function recordStreamClipFeedback(
  workspaceId: string,
  clipId: string,
  kind: StreamFeedbackKind,
) {
  const prisma = getPrisma()
  const clip = await prisma.clip.findFirst({
    where: { id: clipId, workspaceId, deletedAt: null },
    select: {
      id: true,
      projectId: true,
      project: { select: { streamVod: { select: { channelId: true } } } },
    },
  })
  if (!clip) return

  const channelId = clip.project.streamVod?.channelId
  const eventType =
    kind === 'thumbs_down' ? 'thumbs_down' : kind === 'export' ? 'export' : 'download'
  const { createId } = await import('@/lib/supabase/id')
  await prisma.clipEvent.create({
    data: {
      id: createId('cev'),
      clipId,
      workspaceId,
      eventType,
    },
  })

  if (!channelId) return
  const channel = await prisma.streamChannel.findFirst({
    where: { id: channelId, workspaceId, deletedAt: null },
    select: { settings: true },
  })
  if (!channel) return
  const settings = (channel.settings && typeof channel.settings === 'object'
    ? channel.settings
    : {}) as Record<string, unknown>
  const features = (settings.feedbackFeatures && typeof settings.feedbackFeatures === 'object'
    ? settings.feedbackFeatures
    : {}) as Record<string, unknown>
  const byClip = (features.byClip && typeof features.byClip === 'object'
    ? features.byClip
    : {}) as Record<string, Record<string, number>>
  const clipRow = { ...(byClip[clipId] ?? {}) }
  clipRow[kind] = (clipRow[kind] ?? 0) + 1
  byClip[clipId] = clipRow
  const totals = { ...(features.totals as Record<string, number> | undefined) }
  totals[kind] = (totals[kind] ?? 0) + 1
  await prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      settings: {
        ...settings,
        feedbackFeatures: { ...features, totals, byClip },
      },
    },
  })
  console.info('[clipper:stream:feedback]', { workspaceId, clipId, channelId, kind })
}
