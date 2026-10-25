import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listProjectClips } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const sort = url.searchParams.get('sort') === 'timeline' ? 'timeline' : 'score'
    const clips = await listProjectClips(workspaceId, id, sort)
    if (!clips) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { clips } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
