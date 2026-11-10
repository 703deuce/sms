import { NextResponse } from 'next/server'
import { resolveFullVideoLink } from '@/lib/server/clips/full-video-link'
import { jsonError } from '@/lib/server/api-error'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now()
  const requestId = crypto.randomUUID().slice(0, 12)
  let clipId = 'unknown'
  try {
    const params = await ctx.params
    clipId = params.id
    console.info('[clipper:fullvideo-link] route_begin', { requestId, clipId })
    const workspaceId = await resolveWorkspaceId()
    const link = await resolveFullVideoLink(workspaceId, clipId)
    const result = link && 'url' in link ? 'ready' : link && 'preparing' in link ? `preparing:${link.stage}` : 'unavailable'
    console.info('[clipper:fullvideo-link] route_end', {
      requestId,
      clipId,
      result,
      elapsedMs: Date.now() - startedAt,
    })
    return NextResponse.json({ data: link }, { headers: { 'x-full-video-link-request-id': requestId } })
  } catch (e) {
    console.warn('[clipper:fullvideo-link] route_failed', {
      requestId,
      clipId,
      errorName: e instanceof Error ? e.name : 'UnknownError',
      elapsedMs: Date.now() - startedAt,
    })
    return jsonError(e)
  }
}
