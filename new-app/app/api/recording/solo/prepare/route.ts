import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { createRecordingDraftClipProject } from '@/lib/server/recording/draft-project'
import { getOrCreateEditorSoloSession } from '@/lib/server/recording/editor-session'
import { isSoloRecordingApiEnabled } from '@/lib/server/recording/solo-recording-gate'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try {
    if (!isSoloRecordingApiEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json().catch(() => ({}))
    const title =
      typeof (body as { title?: string }).title === 'string' &&
      (body as { title: string }).title.trim()
        ? (body as { title: string }).title.trim().slice(0, 200)
        : 'Recording'
    const projectId = await createRecordingDraftClipProject(workspaceId, title)
    const { session, hostParticipantId } = await getOrCreateEditorSoloSession(
      workspaceId,
      projectId,
      title,
    )
    return NextResponse.json({
      data: {
        projectId,
        sessionId: session.id,
        participantId: hostParticipantId,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
