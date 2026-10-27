import 'server-only'
import { musicCostUsd } from '@/lib/clips/audio'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'

export function estimateDraftMs(doc: T2vDraftV1): number {
  return doc.scenes.reduce((n, s) => n + estimateSceneMs(s), 0) || 60_000
}

export function musicLengthMsForDraft(doc: T2vDraftV1): number {
  const base = estimateDraftMs(doc) + 2000
  return Math.max(3000, Math.min(600_000, base))
}

const TONE_PROMPTS: Record<T2vDraftV1['settings']['tone'], string> = {
  friendly: 'warm friendly instrumental background music',
  professional: 'clean professional corporate instrumental bed',
  energetic: 'upbeat energetic instrumental background music',
  calm: 'calm relaxing instrumental ambient bed',
  inspirational: 'inspiring cinematic instrumental background music',
  humorous: 'light playful quirky instrumental background music',
}

export function buildMusicPromptFromDraft(doc: T2vDraftV1, mood?: string): string {
  const moodBit = mood?.trim() || doc.music?.label?.trim()
  const tone = TONE_PROMPTS[doc.settings.tone] ?? TONE_PROMPTS.friendly
  if (moodBit) return `${moodBit}, ${tone}, no vocals, suitable for a short explainer video`
  return `${tone}, no vocals, suitable for a short explainer video`
}

import type { T2vProjectMusicRow } from '@/lib/t2v/music-types'

export async function listT2vProjectMusic(
  workspaceId: string,
  projectId: string,
): Promise<T2vProjectMusicRow[]> {
  const prisma = getPrisma()
  const gens = await prisma.aiGeneration.findMany({
    where: { workspaceId, kind: 'MUSIC' },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: { id: true, prompt: true, status: true, createdAt: true, params: true },
  })
  return gens
    .filter((g) => {
      const p = g.params as { t2vProjectId?: string } | null
      return p?.t2vProjectId === projectId
    })
    .map((g) => {
      const p = g.params as { lengthMs?: number } | null
      return {
        id: g.id,
        prompt: g.prompt,
        status: g.status,
        createdAt: g.createdAt.toISOString(),
        lengthMs: p?.lengthMs,
      }
    })
}

export async function enqueueT2vMusicGenerate(
  workspaceId: string,
  draftId: string,
  prompt: string,
): Promise<{ generationId: string; jobId: string; estimatedCostUsd: number }> {
  const prisma = getPrisma()
  const row = await prisma.t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const doc = row.document as T2vDraftV1
  const lengthMs = musicLengthMsForDraft(doc)

  const gen = await prisma.aiGeneration.create({
    data: {
      workspaceId,
      kind: 'MUSIC',
      status: 'PENDING',
      provider: 'elevenlabs',
      prompt,
      params: { instrumental: true, lengthMs, t2vProjectId: row.projectId, draftId },
    },
  })
  const jobId = createId('job')
  await prisma.clipJob.create({
    data: {
      id: jobId,
      projectId: row.projectId,
      type: 'MUSIC',
      status: 'QUEUED',
      payload: {
        generationId: gen.id,
        lengthMs,
        instrumental: true,
        prompt,
        t2vProjectId: row.projectId,
      },
    },
  })
  return { generationId: gen.id, jobId, estimatedCostUsd: musicCostUsd(lengthMs) }
}

/** Enqueue a bed on build when the draft has no track yet (not disabled). */
export async function ensureT2vMusicQueuedForBuild(workspaceId: string, draftId: string): Promise<void> {
  const prisma = getPrisma()
  const row = await prisma.t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const doc = row.document as T2vDraftV1
  if (doc.music?.disabled) return
  if (doc.music?.generationId) {
    const existing = await prisma.aiGeneration.findFirst({
      where: { id: doc.music.generationId, workspaceId, kind: 'MUSIC' },
      select: { status: true },
    })
    if (existing && existing.status !== 'FAILED') return
  }
  const prompt = buildMusicPromptFromDraft(doc)
  const { generationId } = await enqueueT2vMusicGenerate(workspaceId, draftId, prompt)
  const music = doc.music ?? { volume: 0.25, duck: true }
  const next: T2vDraftV1 = {
    ...doc,
    music: {
      ...music,
      generationId,
      assetId: generationId,
      label: music.label ?? doc.settings.tone,
      prompt,
    },
  }
  await saveT2vDraft(workspaceId, draftId, row.revision, next)
}

export async function attachUploadedMusic(
  workspaceId: string,
  draftId: string,
  uploadId: string,
): Promise<{ generationId: string }> {
  const prisma = getPrisma()
  const row = await prisma.t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const upl = await prisma.clipUpload.findFirst({
    where: { id: uploadId, workspaceId, status: 'COMPLETE' },
  })
  if (!upl?.key) throw new Error('upload_not_ready')
  const lengthMs = upl.durationMs ? Math.min(600_000, Math.max(3000, upl.durationMs)) : 60_000
  const gen = await prisma.aiGeneration.create({
    data: {
      workspaceId,
      kind: 'MUSIC',
      status: 'READY',
      provider: 'upload',
      prompt: upl.filename || 'Uploaded music',
      storageKey: upl.key,
      params: { instrumental: true, lengthMs, t2vProjectId: row.projectId, uploadId },
    },
  })
  return { generationId: gen.id }
}
