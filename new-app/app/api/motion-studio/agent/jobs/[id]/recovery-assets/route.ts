import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botRecoveryArtifacts } from '@/lib/server/motion-studio/agent-bridge'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    const sourceJobId = new URL(request.url).searchParams.get('sourceJobId') || ''
    return NextResponse.json(await botRecoveryArtifacts(id, request, sourceJobId))
  } catch (error) { return motionStudioJsonError(error) }
}
