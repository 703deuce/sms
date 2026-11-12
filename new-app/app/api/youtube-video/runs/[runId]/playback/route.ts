import 'server-only'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'

export const dynamic = 'force-dynamic'

/** YouTube-only video stream endpoint. Supports browser Range/seek without
 * starting another render or exposing a long-lived storage credential. */
export async function GET(request: Request, context: {
  params: Promise<{ runId: string }>
}): Promise<Response> {
  const workspaceId = await resolveWorkspaceId()
  const { runId } = await context.params
  const run = await getPrisma().youtubeVideoRun.findFirst({
    where: { id: runId, workspaceId, status: 'ready' },
    select: { result: true },
  })
  const result = run?.result && typeof run.result === 'object' && !Array.isArray(run.result)
    ? run.result as Record<string, unknown> : null
  const renderId = typeof result?.renderId === 'string' ? result.renderId : ''
  if (!renderId) return new Response('Episode is not ready', { status: 404 })
  const render = await getPrisma().clipRender.findFirst({
    where: { id: renderId, workspaceId, status: 'READY' },
    select: { outputKey: true, updatedAt: true },
  })
  if (!render?.outputKey) return new Response('Episode render not found', { status: 404 })
  const signed = await createCachedSignedDownloadUrl(getClipStorage(), render.outputKey, {
    versionHint: `youtube-playback:${renderId}:${render.updatedAt.getTime()}`,
  })
  const range = request.headers.get('range')
  // Do not forward browser cookies or authorization to object storage.
  const upstream = await fetch(signed, {
    method: 'GET', headers: range ? { Range: range } : {},
    cache: 'no-store', signal: request.signal,
  })
  if (!upstream.ok || !upstream.body) {
    await upstream.body?.cancel()
    return new Response('Episode media unavailable', { status: upstream.status === 416 ? 416 : 502 })
  }
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, max-age=60',
    'X-Content-Type-Options': 'nosniff',
  })
  for (const name of ['content-range','content-length','etag','last-modified']) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name,value)
  }
  return new Response(upstream.body, { status: upstream.status, headers })
}
