import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import {
  assertSessionHost,
  kickParticipant,
  muteParticipantTrack,
} from '@/lib/server/recording/participant-controls'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string; pid: string }> }

const muteSchema = z.object({
  action: z.literal('mute'),
  actorParticipantId: z.string().min(8),
  trackSid: z.string().min(1),
  muted: z.boolean(),
})

export async function DELETE(request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id: sessionId, pid } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = await request.json().catch(() => ({}))
    const actor = (body as { actorParticipantId?: string }).actorParticipantId
    if (!actor) return NextResponse.json({ error: 'actorParticipantId required' }, { status: 400 })
    await assertSessionHost(sessionId, workspaceId, actor)
    await kickParticipant(sessionId, workspaceId, pid)
    return NextResponse.json({ data: { removed: pid } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id: sessionId, pid } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = muteSchema.parse(await request.json())
    await assertSessionHost(sessionId, workspaceId, body.actorParticipantId)
    await muteParticipantTrack(sessionId, workspaceId, pid, body.trackSid, body.muted)
    return NextResponse.json({ data: { muted: body.muted } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
