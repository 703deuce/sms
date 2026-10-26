import { getPrisma } from '@/lib/server/db'
import { sendTransactionalEmail } from '@/lib/email/brevo'
import { streamReadyEmailHtml } from '@/lib/email/templates/stream-ready'

export type StreamNotifyType =
  | 'stream_ready'
  | 'stream_failed'
  | 'stream_cap'
  | 'autopull_failed'
  | 'modal_budget'

export async function handleStreamerNotify(input: {
  workspaceId: string
  type: StreamNotifyType
  vodId?: string
  montageId?: string
  data?: Record<string, unknown>
}) {
  const prisma = getPrisma()
  const workspace = await prisma.workspace.findUnique({
    where: { id: input.workspaceId },
    select: { id: true, ownerUserId: true },
  })
  if (!workspace) throw new Error('Workspace not found')

  if (input.type === 'stream_ready' && input.vodId) {
    const vod = await prisma.streamVod.findUnique({ where: { id: input.vodId } })
    if (vod?.notifiedAt) return { skipped: true, reason: 'already_notified' }
  }

  const members = await prisma.membership.findMany({
    where: { workspaceId: input.workspaceId },
    select: { userId: true },
  })
  const userIds = members.map((m) => m.userId)
  if (!userIds.length && workspace.ownerUserId) userIds.push(workspace.ownerUserId)
  if (!userIds.length) {
    const fallback = process.env.STREAMER_NOTIFY_FALLBACK_EMAIL?.trim()
    if (fallback && input.type === 'stream_ready') {
      await sendTransactionalEmail({
        to: fallback,
        subject: 'Streamer clips ready',
        html: streamReadyEmailHtml({ title: 'Your stream', clipTitles: [], projectUrl: '/' }),
      })
    }
    return { skipped: true, reason: 'no_users' }
  }

  const projectId =
    (input.data?.projectId as string | undefined) ||
    (input.vodId
      ? (await prisma.streamVod.findUnique({ where: { id: input.vodId }, select: { projectId: true } }))?.projectId
      : undefined)

  const href = projectId ? `/app/clips/${projectId}` : '/app/streamer'
  const { title, body } = notificationCopy(input.type, input.data)

  let emailAllowed = true
  let inAppAllowed = true
  if (projectId) {
    const project = await prisma.clipProject.findUnique({ where: { id: projectId }, select: { settings: true } })
    const settings = (project?.settings ?? {}) as Record<string, unknown>
    const streamer = (settings.streamer ?? {}) as Record<string, unknown>
    const notify = (streamer.notify ?? {}) as Record<string, unknown>
    if (notify.email === false) emailAllowed = false
    if (notify.inApp === false) inAppAllowed = false
  }

  if (inAppAllowed) {
    await prisma.inAppNotification.createMany({
      data: userIds.map((userId) => ({
        workspaceId: input.workspaceId,
        userId,
        type: input.type,
        title,
        body,
        href,
      })),
    })
  }

  if (emailAllowed && input.type === 'stream_ready' && projectId) {
    const clips = await prisma.clip.findMany({
      where: { projectId, deletedAt: null },
      orderBy: { score: 'desc' },
      take: 3,
      select: { title: true },
    })
    const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { email: true } })
    const vodTitle = String(input.data?.vodTitle || title)
    const appUrl = process.env.APP_URL?.replace(/\/$/, '') || ''
    for (const u of users) {
      if (!u.email) continue
      await sendTransactionalEmail({
        to: u.email,
        subject: `🎬 ${clips.length} clips ready from '${vodTitle.slice(0, 48)}'`,
        html: streamReadyEmailHtml({
          title: vodTitle,
          clipTitles: clips.map((c) => c.title),
          projectUrl: `${appUrl}${href}`,
        }),
        workspaceId: input.workspaceId,
      })
    }
  }

  if (input.type === 'stream_ready' && input.vodId) {
    await prisma.streamVod.update({
      where: { id: input.vodId },
      data: { notifiedAt: new Date() },
    })
  }

  return { ok: true }
}

function notificationCopy(type: StreamNotifyType, data?: Record<string, unknown>): { title: string; body: string } {
  switch (type) {
    case 'stream_ready':
      return {
        title: 'Streamer clips ready',
        body: `${data?.clipCount ?? 'Your'} clips are ready to review.`,
      }
    case 'stream_failed':
      return { title: 'Streamer import failed', body: String(data?.error || 'Processing failed.') }
    case 'stream_cap':
      return { title: 'Streamer usage cap reached', body: 'Upgrade or wait for the monthly reset.' }
    case 'autopull_failed':
      return { title: 'Auto-pull failed', body: String(data?.error || 'Could not import the latest VOD.') }
    case 'modal_budget':
      return { title: 'GPU budget warning', body: 'Modal GPU budget is nearly exhausted; using local fallback.' }
    default:
      return { title: 'Streamer update', body: '' }
  }
}
