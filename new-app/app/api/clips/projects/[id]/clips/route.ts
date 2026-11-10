import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { listProjectClips } from '@/lib/server/clips/clips'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID().slice(0, 12)
  let projectId = 'unknown'
  try {
    const { id } = await ctx.params
    projectId = id
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const sort = url.searchParams.get('sort') === 'timeline' ? 'timeline' : 'score'
    const includeHidden = url.searchParams.get('includeHidden') === '1'
    console.info('[clips:list] route_begin', { requestId, projectId, sort, includeHidden })
    if (includeHidden) console.info('[editor:templates-mode] project-clips-load', { projectId: id, includeHidden: true })
    const clips = await listProjectClips(workspaceId, id, sort, includeHidden ? { includeHidden: true } : undefined)
    if (!clips) {
      console.info('[clips:list] route_end', {
        requestId, projectId, status: 404, rows: 0, elapsedMs: Date.now() - startedAt,
      })
      return NextResponse.json({ error: 'Not found' }, {
        status: 404,
        headers: { 'x-clips-list-request-id': requestId },
      })
    }
    console.info('[clips:list] route_end', {
      requestId, projectId, status: 200, rows: clips.length, elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ data: { clips } }, {
      headers: { 'x-clips-list-request-id': requestId },
    })
  } catch (err) {
    console.warn('[clips:list] route_failed', {
      requestId,
      projectId,
      errorName: err instanceof Error ? err.name : 'UnknownError',
      elapsedMs: Date.now() - startedAt,
    })
    return jsonError(err, 500)
  }
}
