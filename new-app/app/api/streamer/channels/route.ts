import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import { createPasteChannel, listStreamerChannels } from '@/lib/server/streamer/channels'
import { getStreamUsage } from '@/lib/server/streamer/usage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const postSchema = z.object({
  platform: z.enum(['twitch', 'kick']),
  login: z.string().min(2),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const [channels, usage] = await Promise.all([
      listStreamerChannels(workspaceId),
      getStreamUsage(workspaceId),
    ])
    return NextResponse.json({ data: { channels, usage } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const body = postSchema.parse(await request.json())
    const ch = await createPasteChannel(workspaceId, body.platform, body.login)
    return NextResponse.json({ data: { id: ch.id } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
