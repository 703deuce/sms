import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isDatabaseReady } from '@/lib/server/app-readiness'
import { getProjectStatus } from '@/lib/server/clips/jobs'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!(await isDatabaseReady())) {
      return NextResponse.json(
        { error: 'Database not ready' },
        { status: 503, headers: { 'Retry-After': '3' } },
      )
    }
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const data = await getProjectStatus(workspaceId, id)
    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 500)
  }
}
