import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getScriptBootstrap } from '@/lib/server/clips/script-bootstrap'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await ctx.params
    const clipId = new URL(request.url).searchParams.get('clipId')
    const workspaceId = await resolveWorkspaceId()
    const data = await getScriptBootstrap(workspaceId, projectId, { clipId })
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
