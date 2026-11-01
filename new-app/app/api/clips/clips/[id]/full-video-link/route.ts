import { NextResponse } from 'next/server'
import { resolveFullVideoLink } from '@/lib/server/clips/full-video-link'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const link = await resolveFullVideoLink(workspaceId, clipId)
    return NextResponse.json({ data: link })
  } catch (e) {
    return jsonError(e)
  }
}
