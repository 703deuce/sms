import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { isRecordingFeatureEnabled } from '@/lib/server/clips/feature-gates'
import { getLiveKitPublicUrl } from '@/lib/server/livekit/env'
import { mintHostTokenForSession } from '@/lib/server/recording/sessions'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export const runtime = 'nodejs'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (!isRecordingFeatureEnabled()) {
      return NextResponse.json({ error: 'Recording is not enabled' }, { status: 503 })
    }
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await mintHostTokenForSession(id, workspaceId)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const url = getLiveKitPublicUrl()
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      return NextResponse.json(
        { error: 'LIVEKIT_URL must be a WebSocket URL (wss://…), not an HTTP API URL' },
        { status: 503 },
      )
    }
    return NextResponse.json({ data: { ...result, url } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
