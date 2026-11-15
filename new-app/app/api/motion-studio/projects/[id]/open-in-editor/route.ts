import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { openInEditor } from '@/lib/server/motion-studio/service'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await openInEditor(workspaceId, id)
    console.info('[motion-studio:api:open-in-editor] ok', { projectId: id })
    return NextResponse.json(result)
  } catch (err) { return motionStudioJsonError(err) }
}
