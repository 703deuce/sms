import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { createCaptionsOnlyProject } from '@/lib/server/ai-captions/create-project'
import { AiCaptionsError } from '@/lib/ai-captions/errors'
import { YoutubeVideoError } from '@/lib/youtube-video/errors'
import { traceYoutubeRunStep } from '@/lib/youtube-video/step-log'
import { youtubeVideoErrorResponse } from '@/lib/server/youtube-video/http'

/** A YouTube source is a transcript-only upload, never a clipper run. */
export async function POST(request: Request) {
  const started = Date.now()
  console.info('[youtube-video:route]', { route: 'POST /api/youtube-video/sources', event: 'entry' })
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json() as { uploadId?: unknown }
    if (typeof body?.uploadId !== 'string' || !body.uploadId.trim()) {
      throw new YoutubeVideoError('invalid_request', 'uploadId is required.', 400)
    }
    const created = await traceYoutubeRunStep(
      'source_upload', 'transcribe_only_project_create',
      () => createCaptionsOnlyProject(workspaceId, body.uploadId as string, null),
    )
    console.info('[youtube-video:route]', {
      route: 'POST /api/youtube-video/sources', event: 'done',
      projectId: created.projectId, elapsedMs: Date.now() - started,
    })
    return NextResponse.json({ data: created }, { status: 201 })
  } catch (err) {
    const safe = err instanceof AiCaptionsError
      ? new YoutubeVideoError(err.code, err.message, err.status)
      : err
    console.error('[youtube-video:route]', {
      route: 'POST /api/youtube-video/sources', event: 'failed',
      elapsedMs: Date.now() - started,
      code: safe instanceof YoutubeVideoError ? safe.code : safe instanceof Error ? safe.name : 'unknown',
    })
    return youtubeVideoErrorResponse(safe)
  }
}
