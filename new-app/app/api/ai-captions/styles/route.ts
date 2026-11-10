import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { listAiCaptionsStyles } from '@/lib/ai-captions/runs'

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const view = await listAiCaptionsStyles(workspaceId, productionRunDeps())
    return NextResponse.json({ data: view })
  } catch (err) {
    return aiCaptionsErrorResponse(err)
  }
}
