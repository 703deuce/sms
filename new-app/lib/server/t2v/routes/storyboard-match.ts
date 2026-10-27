import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { ensureT2vStockAsset } from '@/lib/server/t2v/stock-asset'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { buildSceneStockQuery, matchScenes, toSceneMedia, type StockCandidate } from '@/lib/server/t2v/stock-match'
import { logT2v } from '@/lib/server/t2v/log'
import type { T2vDraftV1 } from '@/lib/t2v/types'
import { pexelsConfigured } from '@/lib/server/ai/pexels'

export type StoryboardMatchSceneError = { sceneId: string; error: string }

function resolveMediaSources(doc: T2vDraftV1): Array<'pexels' | 'pixabay'> {
  const fromDoc = doc.settings.mediaSources.filter((p): p is 'pexels' | 'pixabay' => p !== 'ai_image')
  const sources = [...fromDoc]
  if (pexelsConfigured() && !sources.includes('pexels')) sources.push('pexels')
  if (!sources.includes('pixabay')) sources.push('pixabay')
  return sources
}

function sceneMediaFromPick(
  pick: StockCandidate,
  assetId: string | undefined,
  needMs: number,
  visualQuery: string,
) {
  if (assetId) return toSceneMedia(pick, assetId, needMs, visualQuery)
  const base = toSceneMedia(pick, 'pending', needMs, visualQuery)
  return { ...base, assetId: undefined }
}

export async function runStoryboardMatch(workspaceId: string, draftId: string, sceneId?: string) {
  const d = await getPrisma().t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const doc = d.document as T2vDraftV1
  const sources = resolveMediaSources(doc)
  const todo = doc.scenes.filter((s) => !s.media?.locked && (!sceneId || s.id === sceneId))
  const { byScene: matched, visionMetrics } = await matchScenes({
    scenes: todo.map((s) => ({
      id: s.id,
      visualQuery: s.visualQuery,
      keywords: s.keywords,
      needMs: estimateSceneMs(s),
      narration: s.narration,
    })),
    aspect: doc.settings.aspect,
    sources,
    videoTopic: doc.title,
    workspaceId,
    projectId: d.projectId,
  })
  if (visionMetrics) {
    logT2v('stock-match', 'vision batch totals', {
      draftId,
      sceneCount: visionMetrics.sceneCount,
      latencyMs: visionMetrics.latencyMs,
      costUsdMicros: visionMetrics.costUsdMicros,
      costUsd: Math.round((visionMetrics.costUsdMicros / 1_000_000) * 10000) / 10000,
    })
  }
  const sceneErrors: StoryboardMatchSceneError[] = []
  let applied = 0
  for (const s of todo) {
    const m = matched[s.id]
    if (!m?.pick) {
      sceneErrors.push({ sceneId: s.id, error: 'no_stock_pick' })
      continue
    }
    const needMs = estimateSceneMs(s)
    try {
      const asset = await ensureT2vStockAsset(workspaceId, m.pick)
      s.media = toSceneMedia(m.pick, asset.id, needMs, s.visualQuery)
      logT2v('stock-match', 'scene stock applied', {
        draftId,
        sceneId: s.id,
        query: buildSceneStockQuery(s.visualQuery, s.keywords, doc.title),
        provider: m.pick.provider,
        providerId: m.pick.providerId,
        assetId: asset.id,
        score: m.pick.score,
        relevance: m.pick.relevance,
      })
      applied++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'stock_copy_failed'
      sceneErrors.push({ sceneId: s.id, error: message })
      s.media = sceneMediaFromPick(m.pick, undefined, needMs, s.visualQuery)
      applied++
    }
  }
  const saved = await saveT2vDraft(workspaceId, draftId, d.revision, doc)
  return { ...saved, alternates: matched, sceneErrors, applied }
}
