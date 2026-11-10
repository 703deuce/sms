import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { getAiCaptionsSrt } from '@/lib/ai-captions/runs'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  console.info('[ai-captions:srt] download_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const srt = await getAiCaptionsSrt(workspaceId, runId, productionRunDeps())
    console.info('[ai-captions:srt] download_ready', { runId, bytes: srt.length })
    return new NextResponse(srt, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="captions.srt"',
      },
    })
  } catch (err) {
    console.error('[ai-captions:srt] download_failed', err)
    return aiCaptionsErrorResponse(err)
  }
}
