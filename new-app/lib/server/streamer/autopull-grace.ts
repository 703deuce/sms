import type { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { mergePlatformState } from '@/lib/server/streamer/platform-state'

/** After stream.offline, wait this long before resolving the archive VOD (Part E: ~15 min). */
export function getStreamAutopullGraceSec(): number {
  const unified = Number(process.env.STREAM_AUTOPULL_GRACE_S || '')
  if (Number.isFinite(unified) && unified > 0) return Math.min(3600, Math.max(60, unified))
  return 15 * 60
}

export type PendingAutopullState = {
  vodId: string
  projectId: string
  sessionId?: string
  offlineAt: string
  graceUntil: string
}

export async function recordPendingAutopull(
  channelId: string,
  data: Omit<PendingAutopullState, 'offlineAt' | 'graceUntil'> & { offlineAt?: Date },
) {
  const prisma = getPrisma()
  const ch = await prisma.streamChannel.findUnique({ where: { id: channelId }, select: { platformState: true } })
  if (!ch) return
  const offlineAt = data.offlineAt ?? new Date()
  const graceUntil = new Date(offlineAt.getTime() + getStreamAutopullGraceSec() * 1000)
  const pending: PendingAutopullState = {
    vodId: data.vodId,
    projectId: data.projectId,
    sessionId: data.sessionId,
    offlineAt: offlineAt.toISOString(),
    graceUntil: graceUntil.toISOString(),
  }
  await prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      platformState: mergePlatformState(ch.platformState, { pendingAutopull: pending }) as Prisma.InputJsonValue,
    },
  })
}

/** Stream came back during grace — cancel queued autopull and keep one logical session. */
export async function cancelPendingAutopullIfStreamResumed(
  channelId: string,
  opts?: { sessionId?: string },
): Promise<boolean> {
  const prisma = getPrisma()
  const ch = await prisma.streamChannel.findUnique({ where: { id: channelId }, select: { platformState: true } })
  if (!ch) return false
  const ps = (ch.platformState as Record<string, unknown>) || {}
  const pending = ps.pendingAutopull as PendingAutopullState | undefined
  if (!pending?.vodId) return false
  const graceUntil = Date.parse(pending.graceUntil)
  if (Number.isNaN(graceUntil) || Date.now() > graceUntil) return false

  const jobs = await prisma.clipJob.findMany({
    where: {
      projectId: pending.projectId,
      type: 'STREAM_AUTOPULL',
      status: 'QUEUED',
    },
    select: { id: true, payload: true },
  })
  let cancelled = 0
  for (const job of jobs) {
    const payload = job.payload as Record<string, unknown> | null
    if (payload?.vodId !== pending.vodId) continue
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        error: 'Cancelled: stream resumed within grace window',
        finishedAt: new Date(),
        lockedBy: null,
        lockedAt: null,
      },
    })
    cancelled += 1
  }

  const vodRow = await prisma.streamVod.findUnique({ where: { id: pending.vodId }, select: { state: true } })
  const priorState = (vodRow?.state as Record<string, unknown>) || {}
  await prisma.streamVod.update({
    where: { id: pending.vodId },
    data: {
      state: {
        ...priorState,
        superseded: true,
        supersededReason: 'stream_resumed_grace',
        streamSessionId: pending.sessionId,
      },
    },
  })

  const sessionId = opts?.sessionId || pending.sessionId
  await prisma.streamChannel.update({
    where: { id: channelId },
    data: {
      platformState: mergePlatformState(ch.platformState, {
        pendingAutopull: null,
        live: sessionId
          ? { startedAt: pending.offlineAt, sessionId, resumedInGrace: true }
          : { startedAt: new Date().toISOString(), sessionId: opts?.sessionId },
      }) as Prisma.InputJsonValue,
    },
  })

  if (cancelled > 0) {
    console.info(
      `[clipper:autopull] grace_resume channelId=${channelId} vodId=${pending.vodId} cancelledJobs=${cancelled}`,
    )
  }
  return cancelled > 0
}
