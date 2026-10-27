import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { restoreCompositionVersion } from '@/lib/server/clips/composition-versions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ compositionId: string; versionId: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId, versionId } = await ctx.params
    const result = await restoreCompositionVersion(workspaceId, compositionId, versionId)
    if (!result.ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ revision: result.revision, document: result.document })
  } catch (err) {
    return jsonError(err, 500)
  }
}
