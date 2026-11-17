import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { deleteBrandKit } from '@/lib/server/motion-studio/brand-kits'
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { workspaceId } = await requireMotionStudioCaller(request)
    const { id } = await params
    await deleteBrandKit(workspaceId, id)
    return NextResponse.json({ ok: true })
  } catch (err) { return motionStudioJsonError(err) }
}
