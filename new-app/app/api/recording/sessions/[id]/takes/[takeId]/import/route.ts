import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isTrackUploadApiEnabled } from '@/lib/server/recording/solo-recording-gate'
import { assertTakeTracksFullyUploaded } from '@/lib/server/recording/assert-take-uploaded'
import { finalizeRecordingTakeToProject } from '@/lib/server/recording/finalize-take'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string; takeId: string }> }

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isTrackUploadApiEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id: sessionId, takeId } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json().catch(() => ({}))
    const preferCloudBackup = Boolean((body as { preferCloudBackup?: boolean }).preferCloudBackup)
    await assertTakeTracksFullyUploaded(sessionId, takeId, workspaceId)
    const result = await finalizeRecordingTakeToProject(workspaceId, sessionId, takeId, {
      preferCloudBackup,
    })
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}
