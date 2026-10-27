import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const session = await prisma.recordingSession.findFirst({
      where: { id, workspaceId },
      select: {
        id: true,
        title: true,
        status: true,
        maxParticipants: true,
        liveStartedAt: true,
        liveEndedAt: true,
        participants: { select: { id: true, role: true, displayName: true, status: true } },
      },
    })
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: session })
  } catch (err) {
    return jsonError(err, 500)
  }
}
