import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionForWorkspace } from '@/lib/server/clips/script-composition'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const row = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      data: {
        id: row.id,
        projectId: row.projectId,
        kind: row.kind,
        title: row.title,
        revision: row.revision,
        document: row.document,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
