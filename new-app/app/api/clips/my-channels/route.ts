import { NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonError } from '@/lib/server/api-error'
import {
  deleteClipUserStreamerChannel,
  listClipUserStreamerChannels,
  upsertClipUserStreamerChannel,
} from '@/lib/server/clips/clip-export-user-prefs'
import { normalizeChannelUrl } from '@/lib/clips/export-template'
import { resolveInternalUserId } from '@/lib/server/internal-user'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const postSchema = z.object({
  platform: z.enum(['twitch', 'kick']),
  url: z.string().min(8).max(200),
  label: z.string().max(80).optional(),
})

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const channels = await listClipUserStreamerChannels(workspaceId, userId)
    return NextResponse.json({ data: { channels } })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const body = postSchema.parse(await request.json())
    const url = normalizeChannelUrl(body.url.trim()) || body.url.trim()
    const channel = await upsertClipUserStreamerChannel(workspaceId, userId, {
      platform: body.platform,
      url,
      label: body.label,
    })
    return NextResponse.json({ data: { channel } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function DELETE(request: Request) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const userId = await resolveInternalUserId()
    const url = new URL(request.url)
    const id = url.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    await deleteClipUserStreamerChannel(workspaceId, userId, id)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
