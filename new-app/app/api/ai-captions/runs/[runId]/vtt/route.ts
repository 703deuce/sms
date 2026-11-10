import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { getAiCaptionsRun } from '@/lib/ai-captions/runs'
import { vttFromLines } from '@/lib/ai-captions/vtt'
import { AiCaptionsError } from '@/lib/ai-captions/errors'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  console.info('[ai-captions:vtt] request_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const run = await getAiCaptionsRun(workspaceId, runId, productionRunDeps())
    if (!run.result || (run.status !== 'ready' && run.status !== 'exporting')) {
      throw new AiCaptionsError('vtt_not_ready', 'The captions are not ready to download yet.', 409)
    }
    const content = vttFromLines(run.result.lines)
    console.info('[ai-captions:vtt] response_ready', { runId })
    return new NextResponse(content, { headers: {
      'Content-Type': 'text/vtt; charset=utf-8',
      'Content-Disposition': 'attachment; filename="captions.vtt"',
    } })
  } catch (err) {
    console.error('[ai-captions:vtt] request_failed', err)
    return aiCaptionsErrorResponse(err)
  }
}
