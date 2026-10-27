import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { streamerAutopullUiEnabled } from '@/lib/server/streamer/autopull-ui'
import { listStreamerChannels } from '@/lib/server/streamer/channels'
import { listStreamerIncomingForWorkspace } from '@/lib/server/streamer/vod-list'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET() {
  try {
    if (!streamerAutopullUiEnabled()) {
      return NextResponse.json({ error: 'Auto-pull UI disabled' }, { status: 404 })
    }
    const workspaceId = await resolveWorkspaceId()
    const [channels, incoming] = await Promise.all([
      listStreamerChannels(workspaceId),
      listStreamerIncomingForWorkspace(workspaceId),
    ])
    return NextResponse.json({ data: { channels, incoming } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
