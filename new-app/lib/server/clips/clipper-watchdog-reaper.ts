import {
  canAutoRetryWatchdog,
  progressStallExceeded,
  type ClipperWatchdogSnap,
  watchdogRetryMessage,
  watchdogUserMessage,
} from '@/lib/clips/clipper-watchdog'
import { getPrisma } from '@/lib/server/db'
import { retryFailedRender } from '@/lib/server/clips/renders'

function readSnap(payload: unknown): ClipperWatchdogSnap | null {
  if (!payload || typeof payload !== 'object') return null
  const wd = (payload as { clipperWatchdog?: ClipperWatchdogSnap }).clipperWatchdog
  if (!wd?.lastChangeAt) return null
  return wd
}

function readAutoRetries(payload: unknown): number {
  if (!payload || typeof payload !== 'object') return 0
  const n = (payload as { watchdogAutoRetries?: number }).watchdogAutoRetries
  return typeof n === 'number' && n >= 0 ? n : 0
}

/** Progress-stall watchdog for RUNNING clip jobs (export, transcribe, import). */
export async function reapClipperProgressStalls(): Promise<number> {
  const prisma = getPrisma()
  const running = await prisma.clipJob.findMany({
    where: { status: 'RUNNING' },
    take: 40,
    select: {
      id: true,
      type: true,
      projectId: true,
      clipId: true,
      payload: true,
      attempts: true,
    },
  })

  let acted = 0
  const now = Date.now()

  for (const job of running) {
    const snap = readSnap(job.payload)
    if (!snap || !progressStallExceeded(snap, job.type, now)) continue

    const autoRetries = readAutoRetries(job.payload)
    const payload = (job.payload ?? {}) as Record<string, unknown>

    if (canAutoRetryWatchdog(autoRetries)) {
      const msg = watchdogRetryMessage(snap.phase)
      console.info('[clipper:watchdog]', {
        action: 'auto_retry',
        jobId: job.id,
        jobType: job.type,
        phase: snap.phase,
        progress: snap.progress,
      })
      await prisma.clipJob.update({
        where: { id: job.id },
        data: {
          status: 'QUEUED',
          lockedBy: null,
          lockedAt: null,
          runAfter: new Date(now + 5_000),
          error: msg.slice(0, 500),
          payload: {
            ...payload,
            watchdogAutoRetries: autoRetries + 1,
            clipperWatchdog: {
              ...snap,
              lastChangeAt: new Date(now).toISOString(),
              updatedAt: new Date(now).toISOString(),
            },
          },
        },
      })
      if (job.type === 'RENDER_CLIP') {
        const renderId = payload.renderId as string | undefined
        if (renderId) {
          await prisma.clipRender.updateMany({
            where: { id: renderId, status: 'RENDERING' },
            data: { status: 'QUEUED', error: msg.slice(0, 500) },
          })
        }
      }
      acted += 1
      continue
    }

    const failMsg = watchdogUserMessage(job.type, snap.phase)
    console.info('[clipper:watchdog]', {
      action: 'fail',
      jobId: job.id,
      jobType: job.type,
      phase: snap.phase,
      progress: snap.progress,
    })
    if (job.type === 'RENDER_CLIP') {
      const renderId = payload.renderId as string | undefined
      await prisma.clipJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          error: failMsg.slice(0, 500),
          finishedAt: new Date(),
          lockedBy: null,
          lockedAt: null,
        },
      })
      if (renderId) {
        await prisma.clipRender.update({
          where: { id: renderId },
          data: { status: 'FAILED', error: failMsg.slice(0, 500) },
        })
      }
    } else {
      await prisma.$transaction([
        prisma.clipJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            error: failMsg.slice(0, 500),
            finishedAt: new Date(),
            lockedBy: null,
            lockedAt: null,
          },
        }),
        prisma.clipProject.update({
          where: { id: job.projectId },
          data: {
            status: 'FAILED',
            stage: 'failed',
            progress: 0,
            error: failMsg.slice(0, 500),
          },
        }),
      ])
    }
    acted += 1
  }

  const renderStallMs = 20 * 60_000
  const staleRenders = await prisma.clipRender.findMany({
    where: { status: 'RENDERING', updatedAt: { lt: new Date(now - renderStallMs) } },
    take: 15,
    select: { id: true, workspaceId: true, clipId: true },
  })
  for (const render of staleRenders) {
    const activeJob = await prisma.clipJob.findFirst({
      where: {
        clipId: render.clipId,
        type: 'RENDER_CLIP',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      select: { id: true, payload: true },
    })
    if (activeJob) continue
    const failMsg = watchdogUserMessage('RENDER_CLIP', 'render')
    console.info('[clipper:watchdog]', { action: 'fail_render_orphan', renderId: render.id })
    await prisma.clipRender.update({
      where: { id: render.id },
      data: { status: 'FAILED', error: failMsg.slice(0, 500) },
    })
    try {
      await retryFailedRender(render.workspaceId, render.id)
    } catch {
      /* already retried or not eligible */
    }
    acted += 1
  }

  return acted
}
