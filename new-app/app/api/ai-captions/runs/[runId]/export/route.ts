import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { exportAiCaptionsRun } from '@/lib/ai-captions/runs'

export async function POST(_request: Request, ctx: { params: Promise<{ runId: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { runId } = await ctx.params
    const { view, queued } = await exportAiCaptionsRun(workspaceId, runId, productionRunDeps())
    return NextResponse.json(
      {
        data: {
          runId: view.runId,
          status: view.status,
          downloadUrl: view.result?.downloadUrl ?? null,
          srtUrl: view.result?.srtUrl ?? `/api/ai-captions/runs/${runId}/srt`,
        },
      },
      { status: queued ? 202 : 200 },
    )
  } catch (err) {
    return aiCaptionsErrorResponse(err)
  }
}
