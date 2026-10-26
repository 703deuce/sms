import { getPrisma } from '@/lib/server/db'

import { getStreamerLimits } from './limits'

function monthStartUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
}

export async function getStreamUsage(workspaceId: string) {
  const prisma = getPrisma()
  const periodStart = monthStartUtc()
  const row = await prisma.streamUsage.findUnique({
    where: { workspaceId_periodStart: { workspaceId, periodStart } },
  })
  const limits = await getStreamerLimits(workspaceId)
  const usedHours = (row?.sourceSeconds ?? 0) / 3600
  const capHours = limits.monthlyHours
  const modal = await prisma.aiUsage.aggregate({
    where: {
      workspaceId,
      provider: 'modal',
      createdAt: { gte: periodStart },
    },
    _sum: { costUsdMicros: true },
  })
  return {
    periodStart: periodStart.toISOString().slice(0, 10),
    usedHours,
    capHours,
    vodCount: row?.vodCount ?? 0,
    gpuHours: (row?.modalGpuSeconds ?? 0) / 3600,
    modalUsdThisMonth: (modal._sum.costUsdMicros ?? 0) / 1_000_000,
  }
}

export async function assertStreamCap(workspaceId: string, incomingSeconds: number) {
  const limits = await getStreamerLimits(workspaceId)
  if (limits.monthlyHours === null || limits.monthlyHours === 0) return
  const usage = await getStreamUsage(workspaceId)
  if (usage.usedHours + incomingSeconds / 3600 > limits.monthlyHours) {
    const err = new Error('Monthly stream-hour cap reached')
    ;(err as Error & { code: string; usedH: number; capH: number }).code = 'stream_cap'
    ;(err as Error & { usedH: number }).usedH = usage.usedHours
    ;(err as Error & { capH: number }).capH = limits.monthlyHours
    throw err
  }
}
