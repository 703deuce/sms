import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { resolveClipsActorUserId } from '@/lib/server/clips/clips-auth'
import { createProject, listProjects } from '@/lib/server/motion-studio/service'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    return NextResponse.json(await listProjects(workspaceId, { limit: url.searchParams.get('limit'), cursor: url.searchParams.get('cursor') }))
  } catch (err) { return motionStudioJsonError(err) }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const body: unknown = await request.json().catch(() => ({}))
    const result = await createProject(workspaceId, userId, body, request.headers.get('Idempotency-Key'))
    console.info('[motion-studio:api:create] ok', { projectId: result.project.id, created: result.created })
    return NextResponse.json({ project: result.project }, { status: result.created ? 201 : 200 })
  } catch (err) { return motionStudioJsonError(err) }
}
