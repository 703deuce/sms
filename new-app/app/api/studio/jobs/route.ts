import { NextResponse } from 'next/server'
import { resolveClipsActorUserId } from '../../../../lib/server/clips/clips-auth'
import { resolveWorkspaceId } from '../../../../lib/server/workspace'
import { studioJsonError } from '../../../../lib/studio/http'
import { createStudioJob, listStudioJobs } from '../../../../lib/studio/jobs'
import { createDefaultStudioService } from '../../../../lib/studio/runtime'
import type { StudioCreateJobInput } from '../../../../lib/studio/types'

export async function GET(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const url = new URL(request.url)
    const limitRaw = url.searchParams.get('limit')
    const data = await listStudioJobs(createDefaultStudioService(), workspaceId, {
      limit: limitRaw ? Number(limitRaw) : undefined,
      cursor: url.searchParams.get('cursor'),
      status: url.searchParams.get('status') || undefined,
      modelId: url.searchParams.get('modelId') || undefined,
      projectId: url.searchParams.get('projectId') || undefined,
    })
    return NextResponse.json(data)
  } catch (err) {
    return studioJsonError(err)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveClipsActorUserId(request)
    const body = (await request.json()) as StudioCreateJobInput
    const job = await createStudioJob(createDefaultStudioService(), { workspaceId, userId, body })
    return NextResponse.json({ job }, { status: 201 })
  } catch (err) {
    return studioJsonError(err)
  }
}
