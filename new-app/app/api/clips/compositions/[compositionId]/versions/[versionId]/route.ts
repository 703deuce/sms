import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionVersionDocument } from '@/lib/server/clips/composition-versions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ compositionId: string; versionId: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId, versionId } = await ctx.params
    const document = await getCompositionVersionDocument(workspaceId, compositionId, versionId)
    if (!document) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ document })
  } catch (err) {
    return jsonError(err, 500)
  }
}
