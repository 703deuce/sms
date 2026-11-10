import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'
import { productionRunDeps } from '@/lib/server/youtube-video/deps'
import { createYoutubeVideoRun } from '@/lib/youtube-video/runs'

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json()
    const headerKey = request.headers.get('Idempotency-Key')
    const { view, created } = await createYoutubeVideoRun(
      workspaceId,
      null,
      body,
      headerKey,
      productionRunDeps(),
    )
    return NextResponse.json({ data: view }, { status: created ? 201 : 200 })
  } catch (err) {
    return youtubeVideoErrorResponse(err)
  }
}
