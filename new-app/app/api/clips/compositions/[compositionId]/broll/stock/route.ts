import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { ensureStockAsset, findCachedHit } from '@/lib/server/ai/pixabay'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  providerId: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
})

/** Stock B-roll ingest — same as clip route; composition stores `document.broll` via client op. */
export async function POST(request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const row = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const hit = await findCachedHit(body.providerId)
    if (!hit) return NextResponse.json({ error: 'Asset not in cache; search again' }, { status: 400 })

    const { asset, url } = await ensureStockAsset(hit)
    return NextResponse.json({
      data: {
        assetId: asset.id,
        url,
        thumbUrl: asset.thumbUrl || hit.thumbUrl,
        previewUrl: hit.preview,
        credit: { author: asset.author, pageUrl: asset.pageUrl },
        startMs: body.startMs,
        endMs: body.endMs,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
