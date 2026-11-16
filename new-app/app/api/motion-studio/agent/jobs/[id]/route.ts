import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botGetAssignment } from '@/lib/server/motion-studio/agent-bridge'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json({ job: await botGetAssignment(id, request) })
  } catch (err) { return motionStudioJsonError(err) }
}
