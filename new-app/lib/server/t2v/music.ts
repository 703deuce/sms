import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { T2V_MUSIC_LIBRARY, type T2vMusicLibraryTrack } from '@/lib/t2v/music-library-catalog'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { estimateSceneMs } from '@/lib/t2v/estimate'

export function estimateDraftMs(doc: T2vDraftV1): number {
  return doc.scenes.reduce((n, s) => n + estimateSceneMs(s), 0) || 60_000
}

export async function listT2vMusicLibrary(): Promise<T2vMusicLibraryTrack[]> {
  const prisma = getPrisma()
  const gens = await prisma.aiGeneration.findMany({
    where: { kind: 'MUSIC', status: 'READY' },
    select: { id: true, prompt: true, params: true, outputKey: true },
    take: 200,
  })
  const byCatalogId = new Map<string, string>()
  for (const g of gens) {
    const p = g.params as { t2vCatalogId?: string } | null
    if (p?.t2vCatalogId) byCatalogId.set(p.t2vCatalogId, g.id)
  }
  return T2V_MUSIC_LIBRARY.map((t) => ({
    ...t,
    generationId: byCatalogId.get(t.id) ?? t.generationId,
  }))
}

export async function enqueueT2vMusicGenerate(
  workspaceId: string,
  draftId: string,
  prompt: string,
): Promise<{ generationId: string; jobId: string }> {
  const prisma = getPrisma()
  const row = await prisma.t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const doc = row.document as T2vDraftV1
  const lengthMs = Math.max(30_000, Math.min(180_000, estimateDraftMs(doc)))

  const gen = await prisma.aiGeneration.create({
    data: {
      workspaceId,
      kind: 'MUSIC',
      status: 'PENDING',
      provider: 'elevenlabs',
      prompt,
      params: { instrumental: true, lengthMs, draftId, t2v: true },
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
        draftId,
      },
    },
  })
  return { generationId: gen.id, jobId }
}
