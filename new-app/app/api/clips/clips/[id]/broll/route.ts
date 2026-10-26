import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { ensureStockAsset, findCachedHit } from '@/lib/server/ai/pixabay'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  providerId: z.string().min(1),
  startMs: z.number().int().min(0),
  endMs: z.number().int().min(0),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const hit = await findCachedHit(body.providerId)
    if (!hit) return NextResponse.json({ error: 'Asset not in cache; search again' }, { status: 400 })

    const { asset, url } = await ensureStockAsset(hit)
    return NextResponse.json({
      data: {
        assetId: asset.id,
        url,
        credit: { author: asset.author, pageUrl: asset.pageUrl },
        startMs: body.startMs,
        endMs: body.endMs,
      },
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
