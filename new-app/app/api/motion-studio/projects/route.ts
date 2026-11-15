import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { createProject, listProjects } from '@/lib/server/motion-studio/service'

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireMotionStudioCaller(request)
    const url = new URL(request.url)
    return NextResponse.json(await listProjects(workspaceId, { limit: url.searchParams.get('limit'), cursor: url.searchParams.get('cursor') }))
  } catch (err) { return motionStudioJsonError(err) }
}

export async function POST(request: Request) {
  try {
    const { workspaceId, userId } = await requireMotionStudioCaller(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await createProject(workspaceId, userId, body, request.headers.get('Idempotency-Key'))
    console.info('[motion-studio:api:create] ok', { projectId: result.project.id, created: result.created })
    return NextResponse.json({ project: result.project }, { status: result.created ? 201 : 200 })
  } catch (err) { return motionStudioJsonError(err) }
}
