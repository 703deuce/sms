import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { createRecordingInvite } from '@/lib/server/recording/invites'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({
  role: z.enum(['guest', 'producer']).optional(),
})

export async function POST(request: Request, { params }: Params) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id } = await params
    const workspaceId = await resolveWorkspaceId()
    const body = bodySchema.safeParse(await request.json().catch(() => ({})))
    const role = body.success && body.data.role === 'producer' ? 'PRODUCER' : 'GUEST'
    const invite = await createRecordingInvite(id, workspaceId, role)
    if (!invite) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: invite })
  } catch (err) {
    return jsonError(err, 500)
  }
}
