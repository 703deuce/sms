import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { suggestClarityCuts } from '@/lib/server/clips/clarity-cuts'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { proposals, warning } = await suggestClarityCuts(workspaceId, clipId)
    return NextResponse.json({
      data: { proposals },
      ...(warning ? { warning } : {}),
    })
  } catch (err) {
    return jsonError(err, 400)
  }
}
