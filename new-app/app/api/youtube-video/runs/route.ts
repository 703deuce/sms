import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { createYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function POST(request: Request) {
  const started = Date.now()
  console.info('[youtube-video:route]', { route: 'POST /api/youtube-video/runs', event: 'entry' })
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json()
    const headerKey = request.headers.get('Idempotency-Key')
    const { view, created } = await createYoutubeVideoRun(
      workspaceId,
      null,
      body,
      headerKey,
      productionRunDeps(),
    )
    console.info('[youtube-video:route]', {
      route: 'POST /api/youtube-video/runs', event: 'done',
      runId: view.runId, status: view.status, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: view }, { status: created ? 201 : 200 })
  } catch (err) {
    console.error('[youtube-video:route]', {
      route: 'POST /api/youtube-video/runs', event: 'failed',
      elapsedMs: Date.now() - started,
      code: err instanceof Error && 'code' in err ? String(err.code) : err instanceof Error ? err.name : 'unknown',
    })
    return youtubeVideoErrorResponse(err)
  }
}
