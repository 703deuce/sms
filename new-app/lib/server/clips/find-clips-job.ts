import 'server-only'

import { createId } from '@/lib/supabase/id'
import { isFullVideoSettings } from '@/lib/clips/full-video'
import { buildProcessProjectJobPayload } from '@/lib/server/clips/process-project-payload'
import { findClipSettingsFor } from '@/lib/server/clips/full-video-projects'
import { getPrisma } from '@/lib/server/db'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { ReasonTag } from '@/lib/clips/reason-tag'

type FindResultPick = {
  startMs: number
  endMs: number
  score: number
  title: string
  reasonTag: string
  why: string | null
  hook?: string
}

function parseFindPayload(payload: unknown): {
  find?: { stage?: string; progress?: number }
  findResult?: { picks?: FindResultPick[] }
  settingsOverride?: unknown
} {
  if (!payload || typeof payload !== 'object') return {}
  return payload as {
    find?: { stage?: string; progress?: number }
    findResult?: { picks?: FindResultPick[] }
    settingsOverride?: unknown
  }
}

export async function queueFindClipsJob(workspaceId: string, projectId: string) {
  const prisma = getPrisma()
  const src = await prisma.clipProject.findFirst({ where: { id: projectId, workspaceId, deletedAt: null } })
  if (!src) return null
  if (!isFullVideoSettings(src.settings)) throw new Error('Only full-video projects can start clip finding here')
  if (!src.uploadId) throw new Error('This video has no upload to find clips in')
  const upload = await prisma.clipUpload.findFirst({ where: { id: src.uploadId, workspaceId, status: 'COMPLETE' } })
  if (!upload) throw new Error('Upload not complete')

  const existing = await prisma.clipJob.findFirst({
    where: {
      projectId,
      type: 'FIND_CLIPS',
      status: { in: ['QUEUED', 'RUNNING'] },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return { jobId: existing.id, status: existing.status }

  const clipSettings = findClipSettingsFor(src, upload)
  const built = buildProcessProjectJobPayload(clipSettings, {}) as Record<string, unknown>
  const { byo: _byo, fullVideo: _fv, ...rest } = built
  const payload = {
    ...rest,
    findOnly: true,
    settingsOverride: clipSettings,
  }

  const job = await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId,
      type: 'FIND_CLIPS',
      status: 'QUEUED',
      payload: toPrismaJson(payload),
    },
  })
  return { jobId: job.id, status: job.status }
}

export async function latestFindClips(projectId: string) {
  const prisma = getPrisma()
  const job = await prisma.clipJob.findFirst({
    where: { projectId, type: 'FIND_CLIPS' },
    orderBy: { createdAt: 'desc' },
  })
  if (!job) return null
  const pl = parseFindPayload(job.payload)
  const find = pl.find
  const picksRaw = pl.findResult?.picks ?? []
  const picks = picksRaw.map((p, i) => ({
    clipId: `fp_${job.id}_${i}`,
    title: p.title,
    startMs: p.startMs,
    endMs: p.endMs,
    score: p.score,
    reasonTag: (p.reasonTag || 'speech') as ReasonTag,
    why: p.why,
    findJobId: job.id,
    origin: 'find' as const,
  }))
  return {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    stage: find?.stage ?? null,
    progress: typeof find?.progress === 'number' ? find.progress : null,
    picks,
  }
}
