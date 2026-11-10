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
    const includeHidden = url.searchParams.get('includeHidden') === '1'
    if (includeHidden) console.info('[editor:templates-mode] project-clips-load', { projectId: id, includeHidden: true })
    const clips = await listProjectClips(workspaceId, id, sort, includeHidden ? { includeHidden: true } : undefined)
    if (!clips) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { clips } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
