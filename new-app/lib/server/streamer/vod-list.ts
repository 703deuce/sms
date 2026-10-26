import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

const TERMINAL: ClipProjectStatus[] = ['READY', 'FAILED', 'CANCELED']

export type StreamerVodRow = {
  vodId: string
  projectId: string
  title: string
  platform: string
  url: string | null
  status: ClipProjectStatus
  stage: string | null
  progress: number
  etaSec: number
  chunkDone?: number
  chunkTotal?: number
  createdAt: string
}

function etaForProject(project: {
  status: ClipProjectStatus
  rangeEndMs: number
  rangeStartMs: number
  settings: unknown
}) {
  const sourceMin = Math.max(1, Math.ceil((project.rangeEndMs - project.rangeStartMs) / 60_000))
  const settings = (project.settings ?? {}) as Record<string, unknown>
  const sp = (settings.streamerProgress ?? {}) as Record<string, number>
  const workerEta = typeof sp.etaSeconds === 'number' ? sp.etaSeconds : 0
  if (TERMINAL.includes(project.status)) return 0
  return workerEta > 0 ? workerEta : sourceMin * 45
}

export async function listStreamerVodsForWorkspace(workspaceId: string): Promise<StreamerVodRow[]> {
  const prisma = getPrisma()
  const rows = await prisma.streamVod.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      project: {
        select: {
          id: true,
          status: true,
          stage: true,
          progress: true,
          settings: true,
          rangeEndMs: true,
          rangeStartMs: true,
        },
      },
    },
  })
  return rows.map((v) => {
    const settings = (v.project.settings ?? {}) as Record<string, unknown>
    const sp = (settings.streamerProgress ?? {}) as Record<string, number>
    return {
      vodId: v.id,
      projectId: v.projectId,
      title: v.title?.trim() || 'Stream import',
      platform: v.platform,
      url: v.url,
      status: v.project.status,
      stage: v.project.stage,
      progress: v.project.progress,
      etaSec: etaForProject(v.project),
      chunkDone: typeof sp.chunkDone === 'number' ? sp.chunkDone : undefined,
      chunkTotal: typeof sp.chunkTotal === 'number' ? sp.chunkTotal : undefined,
      createdAt: v.createdAt.toISOString(),
    }
  })
}
