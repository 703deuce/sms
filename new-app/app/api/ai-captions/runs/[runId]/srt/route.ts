import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { getAiCaptionsSrt } from '@/lib/ai-captions/runs'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const srt = await getAiCaptionsSrt(workspaceId, runId, productionRunDeps())
    return new NextResponse(srt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="captions.srt"',
      },
    })
  } catch (err) {
    return aiCaptionsErrorResponse(err)
  }
}
