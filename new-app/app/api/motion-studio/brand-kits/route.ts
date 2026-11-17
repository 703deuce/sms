import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { listBrandKits, saveBrandKit } from '@/lib/server/motion-studio/brand-kits'
export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireMotionStudioCaller(request)
    return NextResponse.json({ kits: await listBrandKits(workspaceId) })
  } catch (err) { return motionStudioJsonError(err) }
}
export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireMotionStudioCaller(request)
    return NextResponse.json({ kit: await saveBrandKit(workspaceId, await request.json()) })
  } catch (err) { return motionStudioJsonError(err) }
}
