import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { removeProjectMedia } from '@/lib/server/clips/project-media'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** E5: detach a library item (the upload itself is kept). 409 while a clip still uses it. */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string; mediaId: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId, mediaId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const res = await removeProjectMedia(workspaceId, projectId, mediaId)
    if (res === 'not_found') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (res === 'in_use') return NextResponse.json({ error: 'Used by a clip — remove it from the timeline first' }, { status: 409 })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
