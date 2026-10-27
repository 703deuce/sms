import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { joinRecordingWithInvite } from '@/lib/server/recording/invites'

export const runtime = 'nodejs'

const bodySchema = z.object({
  inviteToken: z.string().min(16),
  displayName: z.string().min(1).max(120),
})

export async function POST(request: Request) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const body = bodySchema.parse(await request.json())
    const result = await joinRecordingWithInvite(body)
    if ('error' in result) {
      const status = result.error === 'invalid' ? 404 : 409
      return NextResponse.json({ error: result.error }, { status })
    }
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}
