// POST: match stock media for every scene without locked media (Pixabay now, Pexels when key is set).
import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { matchScenes, toSceneMedia } from '@/lib/server/t2v/stock-match'
import { ensureStockAsset } from '@/lib/server/t2v/stock-asset' // wraps pixabay.ts ensureStockAsset via getClipStorage()
import { estimateSceneMs } from '@/lib/t2v/defaults'
import { saveT2vDraft } from '@/lib/server/t2v/drafts'

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const workspaceId = await resolveWorkspaceId()
  const d = await getPrisma().t2vDraft.findFirstOrThrow({ where: { id, workspaceId } })
  const doc = d.document as any
  const todo = doc.scenes.filter((s: any) => !s.media?.locked)
  const matched = await matchScenes({
    scenes: todo.map((s: any) => ({ id: s.id, visualQuery: s.visualQuery, keywords: s.keywords, needMs: estimateSceneMs(s) })),
    aspect: doc.settings.aspect,
    sources: doc.settings.mediaSources.filter((p: string) => p !== 'ai_image'),
  })
  for (const s of todo) {
    const m = matched[s.id]
    if (!m?.pick) continue // UI shows "No match - search or generate" state on that card
    const asset = await ensureStockAsset(workspaceId, m.pick) // REUSE pixabay.ts ensureStockAsset (fix driver bug, see spec)
    s.media = toSceneMedia(m.pick, asset.id, estimateSceneMs(s), s.visualQuery)
  }
  return NextResponse.json({ data: { ...(await saveT2vDraft(workspaceId, id, d.revision, doc)), alternates: matched } })
}
