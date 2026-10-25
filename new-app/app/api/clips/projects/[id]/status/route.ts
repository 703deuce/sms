import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getProjectStatus } from '@/lib/server/clips/jobs'
import { assertClipsRouteAccess } from '@/lib/server/clips-route-access'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertClipsRouteAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const data = await getProjectStatus(workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
