import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { attachStockAudioToProject } from '@/lib/server/ai/stock-audio'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  stockId: z.string().min(1).max(120),
})

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const body = bodySchema.parse(await request.json())
    const { uploadId } = await attachStockAudioToProject(workspaceId, clip.projectId, body.stockId)
    return NextResponse.json({ data: { uploadId } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unknown')) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return jsonError(err, 400)
  }
}
