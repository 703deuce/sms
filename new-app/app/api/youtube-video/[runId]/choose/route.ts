import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { chooseYoutubeVideoOption } from '@/lib/youtube-video/runs'

export async function POST(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const body = (await request.json()) as { optionId?: string }
    const view = await chooseYoutubeVideoOption(workspaceId, runId, body.optionId ?? '', productionRunDeps())
    return NextResponse.json({ data: { runId: view.runId, status: view.status } })
  } catch (err) {
    return youtubeVideoErrorResponse(err)
  }
}
