import 'server-only'
import { getPrisma } from '@/lib/server/db'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'
import { ensureT2vStockAsset } from '@/lib/server/t2v/stock-asset'
import { estimateSceneMs } from '@/lib/t2v/estimate'
import { matchScenes, toSceneMedia } from '@/lib/server/t2v/stock-match'
import type { T2vDraftV1 } from '@/lib/t2v/types'

export async function runStoryboardMatch(workspaceId: string, draftId: string) {
  const d = await getPrisma().t2vDraft.findFirstOrThrow({ where: { id: draftId, workspaceId } })
  const doc = d.document as T2vDraftV1
  const sources = doc.settings.mediaSources.filter((p): p is 'pexels' | 'pixabay' => p !== 'ai_image')
  const todo = doc.scenes.filter((s) => !s.media?.locked)
  const matched = await matchScenes({
    scenes: todo.map((s) => ({
      id: s.id,
      visualQuery: s.visualQuery,
      keywords: s.keywords,
      needMs: estimateSceneMs(s),
    })),
    aspect: doc.settings.aspect,
    sources,
  })
  for (const s of todo) {
    const m = matched[s.id]
    if (!m?.pick) continue
    const asset = await ensureT2vStockAsset(workspaceId, m.pick)
    s.media = toSceneMedia(m.pick, asset.id, estimateSceneMs(s), s.visualQuery)
  }
  const saved = await saveT2vDraft(workspaceId, draftId, d.revision, doc)
  return { ...saved, alternates: matched }
}
