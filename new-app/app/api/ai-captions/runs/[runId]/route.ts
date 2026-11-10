import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { getAiCaptionsRun } from '@/lib/ai-captions/runs'

export async function GET(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  console.info('[ai-captions:api] status_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const view = await getAiCaptionsRun(workspaceId, runId, productionRunDeps())
    return NextResponse.json({ data: view })
  } catch (err) {
    console.error('[ai-captions:api] status_failed', err)
    return aiCaptionsErrorResponse(err)
  }
}
