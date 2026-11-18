import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { dispatchAgentJob, userAgentJob } from '@/lib/server/motion-studio/agent-bridge'
import { MotionStudioError } from '@/lib/server/motion-studio/errors'
import { pollingRoute } from '@/lib/server/db-read-gate'


export const GET = pollingRoute(async function GET(request: Request) {
  try {
    const { workspaceId, userId } = await requireMotionStudioCaller(request)
    const projectId = new URL(request.url).searchParams.get('projectId') || ''
    if (!projectId) throw new MotionStudioError('INVALID', 'projectId required.', 400)
    return NextResponse.json({ job: await userAgentJob(workspaceId, projectId, userId) })
  } catch (err) { return motionStudioJsonError(err) }
})

export async function POST(request: Request) {
  try {
    const { workspaceId, userId } = await requireMotionStudioCaller(request)
    const body = await request.json().catch(() => ({})) as { projectId?: unknown }
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    if (!projectId || projectId.length > 180) throw new MotionStudioError('INVALID', 'Valid projectId required.', 400)
    const job = await dispatchAgentJob(workspaceId, userId, projectId, request.headers.get('Idempotency-Key'), request)
    return NextResponse.json({ job }, { status: 202 })
  } catch (err) { return motionStudioJsonError(err) }
}
