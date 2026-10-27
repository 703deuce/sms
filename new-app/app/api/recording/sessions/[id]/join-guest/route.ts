import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { joinRecordingSessionAsGuest } from '@/lib/server/recording/sessions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  displayName: z.string().min(1).max(120),
})

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id: sessionId } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const result = await joinRecordingSessionAsGuest(sessionId, workspaceId, body.displayName)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: result })
  } catch (err) {
    if (err instanceof Error && err.message === 'Room is full') {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    if (err instanceof Error && err.message === 'Session is closed') {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    return jsonError(err, 500)
  }
}
