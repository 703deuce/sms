import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { recheckChannelVodHealth } from '@/lib/server/streamer/vod-health'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import type { VodAvailabilityView } from '@/lib/streamer/vod-availability'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const ch = await getPrisma().streamChannel.findFirst({
      where: { id, workspaceId, deletedAt: null },
    })
    if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const ps = (ch.platformState as Record<string, unknown>) || {}
    const vodSaving = ps.vodSaving as VodAvailabilityView | undefined
    const skippedStreams = Array.isArray(ps.skippedStreams) ? ps.skippedStreams : []
    return NextResponse.json({ data: { vodSaving, skippedStreams } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const view = await recheckChannelVodHealth(id, workspaceId)
    return NextResponse.json({ data: view })
  } catch (err) {
    return jsonError(err, 400)
  }
}
