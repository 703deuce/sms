import type { ClipProjectStatus } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'

const TERMINAL: ClipProjectStatus[] = ['READY', 'FAILED', 'CANCELED']

export async function getProjectStatus(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) return null
  const sourceMin = Math.max(1, Math.ceil((project.rangeEndMs - project.rangeStartMs) / 60_000))
  const etaSec = TERMINAL.includes(project.status) ? 0 : sourceMin * 45
  const clipCount =
    project.status === 'READY'
      ? await prisma.clip.count({ where: { projectId, deletedAt: null } })
      : undefined
  return {
    status: project.status,
    stage: project.stage,
    progress: project.progress,
    error: project.error,
    etaSec,
    wordCount: Array.isArray(project.transcriptWords) ? (project.transcriptWords as unknown[]).length : 0,
    clipCount,
  }
}

export async function cancelProject(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const project = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId } })
  if (!project) throw new Error('Not found')
  if (TERMINAL.includes(project.status)) return project
  await prisma.$transaction([
    prisma.clipProject.update({
      where: { id: projectId },
      data: { status: 'CANCELED', stage: 'canceled', error: null },
    }),
    prisma.clipJob.updateMany({
      where: { projectId, status: { in: ['QUEUED', 'RUNNING'] } },
      data: { status: 'FAILED', error: 'Canceled by user', finishedAt: new Date() },
    }),
  ])
  return prisma.clipProject.findUniqueOrThrow({ where: { id: projectId } })
}

export async function applyJobProgress(input: {
  jobId: string
  projectStatus?: ClipProjectStatus
  stage?: string
  progress?: number
  error?: string | null
  transcriptWords?: unknown
}) {
  const prisma = getPrisma()
  const job = await prisma.clipJob.findUnique({ where: { id: input.jobId } })
  if (!job) throw new Error('Job not found')
  const data: Record<string, unknown> = {}
  if (input.projectStatus) data.status = input.projectStatus
  if (input.stage !== undefined) data.stage = input.stage
  if (input.progress !== undefined) data.progress = input.progress
  if (input.error !== undefined) data.error = input.error
  if (input.transcriptWords !== undefined) data.transcriptWords = input.transcriptWords
  if (Object.keys(data).length) {
    await prisma.clipProject.update({ where: { id: job.projectId }, data })
  }
}

export async function reapStaleJobs() {
  const prisma = getPrisma()
  const cutoff = new Date(Date.now() - 5 * 60_000)
  const stale = await prisma.clipJob.findMany({
    where: { status: 'RUNNING', lockedAt: { lt: cutoff }, attempts: { lt: 3 } },
    take: 20,
  })
  for (const job of stale) {
    await prisma.clipJob.update({
      where: { id: job.id },
      data: {
        status: 'QUEUED',
        lockedBy: null,
        lockedAt: null,
        attempts: { increment: 1 },
        runAfter: new Date(),
      },
    })
  }
  return stale.length
}
