import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { createRecordingSession } from '@/lib/server/recording/sessions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  projectId: z.string().min(8).optional(),
  hostDisplayName: z.string().min(1).max(120).default('Host'),
  maxParticipants: z.number().int().min(2).max(12).optional(),
})

export async function POST(request: Request) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const result = await createRecordingSession({
      workspaceId,
      title: body.title,
      projectId: body.projectId,
      hostDisplayName: body.hostDisplayName,
      maxParticipants: body.maxParticipants,
    })
    const res = NextResponse.json({
      data: {
        sessionId: result.session.id,
        livekitRoom: result.session.livekitRoom,
        status: result.session.status,
        url: result.url,
        token: result.token,
        hostParticipantId: result.session.participants[0]?.id,
      },
    })
    res.cookies.set(`rooms_host_${result.session.id}`, '1', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    })
    return res
  } catch (err) {
    return jsonError(err, 500)
  }
}
