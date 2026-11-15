import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { motionStudioConfig } from '@/lib/server/motion-studio/service'

export async function GET() {
  try {
    await resolveWorkspaceId()
    return NextResponse.json(motionStudioConfig())
  } catch (err) { return motionStudioJsonError(err) }
}
