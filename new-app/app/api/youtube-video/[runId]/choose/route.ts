import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { chooseYoutubeVideoOption } from '@/lib/youtube-video/runs'

export async function POST(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  const started = Date.now()
  console.info('[youtube-video:route]', { route: 'POST /api/youtube-video/:runId/choose', event: 'entry' })
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const body = (await request.json()) as { optionId?: string }
    const view = await chooseYoutubeVideoOption(workspaceId, runId, body.optionId ?? '', productionRunDeps())
    console.info('[youtube-video:route]', {
      route: 'POST /api/youtube-video/:runId/choose', event: 'done',
      runId: view.runId, status: view.status, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: { runId: view.runId, status: view.status } })
  } catch (err) {
    console.error('[youtube-video:route]', {
      route: 'POST /api/youtube-video/:runId/choose', event: 'failed',
      elapsedMs: Date.now() - started,
      code: err instanceof Error && 'code' in err ? String(err.code) : err instanceof Error ? err.name : 'unknown',
    })
    return youtubeVideoErrorResponse(err)
  }
}
