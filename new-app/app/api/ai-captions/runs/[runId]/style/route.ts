import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { applyAiCaptionsStyle } from '@/lib/ai-captions/runs'

export async function POST(request: Request, ctx: { params: Promise<{ runId: string }> }) {
  console.info('[ai-captions:api] style_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const body = await request.json()
    const view = await applyAiCaptionsStyle(workspaceId, runId, body, productionRunDeps())
    return NextResponse.json({ data: view })
  } catch (err) {
    console.error('[ai-captions:api] style_failed', err)
    return aiCaptionsErrorResponse(err)
  }
}
