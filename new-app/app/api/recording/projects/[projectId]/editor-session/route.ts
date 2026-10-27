import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isSoloRecordingApiEnabled } from '@/lib/server/recording/solo-recording-gate'
import { getOrCreateEditorSoloSession } from '@/lib/server/recording/editor-session'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ projectId: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    if (!isSoloRecordingApiEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { projectId } = await params
    const workspaceId = await resolveWorkspaceId()
    const { session, hostParticipantId } = await getOrCreateEditorSoloSession(
      workspaceId,
      projectId,
      'Editor recording',
    )
    return NextResponse.json({
      data: {
        sessionId: session.id,
        participantId: hostParticipantId,
        kind: session.kind,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
