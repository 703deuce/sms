import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { aiCaptionsErrorResponse } from '@/lib/server/ai-captions/http'
import { productionRunDeps } from '@/lib/server/ai-captions/deps'
import { createAiCaptionsRun } from '@/lib/ai-captions/runs'

export async function POST(request: Request) {
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
    return NextResponse.json({ data: view }, { status: created ? 201 : 200 })
  } catch (err) {
    return aiCaptionsErrorResponse(err)
  }
}
