import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { cancelProject } from '@/lib/server/clips/jobs'
import { serializeProject } from '@/lib/server/clips/serialize'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const project = await cancelProject(workspaceId, id)
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    return jsonError(err, 400)
  }
}
