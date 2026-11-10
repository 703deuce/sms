import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { createAdRun, listAdRuns } from '@/lib/server/ad-studio/service'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function GET(request: Request) {
  console.info('[ad-studio:api:runs] list_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const result = await listAdRuns(workspaceId, {
      limit: url.searchParams.get('limit'),
      cursor: url.searchParams.get('cursor'),
      status: url.searchParams.get('status'),
    })
    console.info('[ad-studio:api:runs] list_success', { count: result.runs.length })
    return NextResponse.json(result)
  } catch (err) { return adStudioJsonError(err) }
}

export async function POST(request: Request) {
  console.info('[ad-studio:api:runs] create_begin')
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const body: unknown = await request.json()
    const result = await createAdRun(workspaceId, userId, body, request.headers.get('Idempotency-Key'))
    console.info('[ad-studio:api:runs] create_success', { runId: result.run.id, status: result.run.status, created: result.created })
    return NextResponse.json({ run: result.run }, { status: result.created ? 201 : 200 })
  } catch (err) { return adStudioJsonError(err) }
}
