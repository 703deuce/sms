import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { getYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const started = Date.now()
  console.info('[youtube-video:route]', { route: 'GET /api/youtube-video/runs/:runId', event: 'entry' })
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const view = await getYoutubeVideoRun(workspaceId, runId, productionRunDeps(), !(process.env.YOUTUBE_VIDEO_DRIVER_TOKEN || process.env.CRON_SECRET))
    console.info('[youtube-video:route]', {
      route: 'GET /api/youtube-video/runs/:runId', event: 'done',
      runId: view.runId, status: view.status, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: view })
  } catch (err) {
    console.error('[youtube-video:route]', {
      route: 'GET /api/youtube-video/runs/:runId', event: 'failed',
      elapsedMs: Date.now() - started,
      code: err instanceof Error && 'code' in err ? String(err.code) : err instanceof Error ? err.name : 'unknown',
    })
    return youtubeVideoErrorResponse(err)
  }
}
