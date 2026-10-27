import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { completeRecordingTrackUpload } from '@/lib/server/recording/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ trackId: string }> }

export async function POST(_request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { trackId } = await params
    const workspaceId = await resolveWorkspaceId()
    const result = await completeRecordingTrackUpload(workspaceId, trackId)
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}
