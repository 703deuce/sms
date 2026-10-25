import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { logClipEvent, type ClipEventType } from '@/lib/server/clips/events'
import { resolveWorkspaceId } from '@/lib/server/workspace'

const ALLOWED: ClipEventType[] = ['preview_play', 'download', 'edit_open', 'delete']

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = (await request.json()) as { eventType?: string }
    const eventType = body.eventType as ClipEventType
    if (!eventType || !ALLOWED.includes(eventType)) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }
    await logClipEvent(workspaceId, id, eventType)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
