import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { revertYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function POST(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const started = Date.now()
  console.info('[youtube-video:route]', { route: 'POST /api/youtube-video/:runId/revert', event: 'entry' })
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const view = await revertYoutubeVideoRun(workspaceId, runId, productionRunDeps())
    console.info('[youtube-video:route]', {
      route: 'POST /api/youtube-video/:runId/revert', event: 'done',
      runId: view.runId, status: view.status, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: { runId: view.runId, status: view.status, result: view.result } })
  } catch (err) {
    console.error('[youtube-video:route]', {
      route: 'POST /api/youtube-video/:runId/revert', event: 'failed',
      elapsedMs: Date.now() - started,
      code: err instanceof Error && 'code' in err ? String(err.code) : err instanceof Error ? err.name : 'unknown',
    })
    return youtubeVideoErrorResponse(err)
  }
}
