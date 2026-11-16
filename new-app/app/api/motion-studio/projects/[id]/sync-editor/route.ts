import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { syncEditorClipIfStale } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const { workspaceId } = await requireMotionStudioCaller(request)
    const body = await request.json().catch(() => ({})) as { clipId?: unknown }
    if (typeof body.clipId !== 'string' || !body.clipId.startsWith('clip_')) {
      return NextResponse.json({ error: 'Invalid editor clip.' }, { status: 400 })
    }
    const updated = await syncEditorClipIfStale(workspaceId, id, body.clipId)
    return NextResponse.json({ updated })
  } catch (err) { return motionStudioJsonError(err) }
}
