import { NextResponse } from 'next/server'
import { requireMotionStudioCaller } from '@/lib/server/motion-studio/auth'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { motionStudioConfig } from '@/lib/server/motion-studio/service'

export async function GET(request: Request) {
  try {
    await requireMotionStudioCaller(request)
    return NextResponse.json(motionStudioConfig())
  } catch (err) { return motionStudioJsonError(err) }
}
