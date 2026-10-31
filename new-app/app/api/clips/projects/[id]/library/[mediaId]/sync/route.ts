import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { queueMediaSync } from '@/lib/server/clips/project-media'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** E5: queue the worker's audio sync (MEDIA_SYNC) of an uploaded angle; poll the library for the result. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string; mediaId: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId, mediaId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const item = await queueMediaSync(workspaceId, projectId, mediaId)
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { item } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
