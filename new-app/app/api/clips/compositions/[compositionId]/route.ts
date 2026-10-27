import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionForWorkspace, parseScriptCompositionDocument } from '@/lib/server/clips/script-composition'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ compositionId: string }> }) {
  try {
    const { compositionId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const row = await getCompositionForWorkspace(workspaceId, compositionId)
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const document = parseScriptCompositionDocument(row.document)
    return NextResponse.json({
      data: {
        id: row.id,
        revision: row.revision,
        document,
        kind: row.kind,
        clipId: row.clipId,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
