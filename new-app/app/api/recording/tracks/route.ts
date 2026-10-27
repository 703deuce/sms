import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { registerRecordingTrack } from '@/lib/server/recording/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

const bodySchema = z.object({
  sessionId: z.string().min(8),
  takeId: z.string().min(8),
  participantId: z.string().min(8),
  trackId: z.string().min(8).optional(),
  kind: z.enum(['CAMERA', 'MICROPHONE', 'SCREEN', 'SCREEN_AUDIO']),
  mimeType: z.string().min(3).max(120),
  sampleRate: z.number().int().positive().optional(),
  actualStartHostMs: z.number().int().nonnegative().optional(),
  segmentIndex: z.number().int().nonnegative().optional(),
})

export async function POST(request: Request) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.parse(await request.json())
    const track = await registerRecordingTrack({ workspaceId, ...body })
    return NextResponse.json({ data: { trackId: track.id } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
