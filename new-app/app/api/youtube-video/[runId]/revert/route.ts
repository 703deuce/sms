import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { revertYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function POST(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const view = await revertYoutubeVideoRun(workspaceId, runId, productionRunDeps())
    return NextResponse.json({ data: { runId: view.runId, status: view.status, result: view.result } })
  } catch (err) {
    return youtubeVideoErrorResponse(err)
  }
}
