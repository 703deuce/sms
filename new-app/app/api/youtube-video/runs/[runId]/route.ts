import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { getYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const view = await getYoutubeVideoRun(workspaceId, runId, productionRunDeps())
    return NextResponse.json({ data: view })
  } catch (err) {
    return youtubeVideoErrorResponse(err)
  }
}
