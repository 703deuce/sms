import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { createAiCaptionsRun, listAiCaptionsRuns } from '@/lib/ai-captions/runs'

export async function GET() {
  console.info('[ai-captions:api] list_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const data = await listAiCaptionsRuns(workspaceId, productionRunDeps())
    console.info('[ai-captions:api] list_success', { count: data.length })
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[ai-captions:api] list_failed', err)
    return aiCaptionsErrorResponse(err)
  }
}

export async function POST(request: Request) {
  console.info('[ai-captions:api] create_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json()
    const headerKey = request.headers.get('Idempotency-Key')
    const { view, created } = await createAiCaptionsRun(
      workspaceId,
      null,
      body,
      headerKey,
      productionRunDeps(),
    )
    console.info('[ai-captions:api] create_complete', { runId: view.runId, status: view.status, created })
    return NextResponse.json({ data: view }, { status: created ? 201 : 200 })
  } catch (err) {
    return aiCaptionsErrorResponse(err)
  }
}
