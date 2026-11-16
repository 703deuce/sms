import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botParentArtifacts } from '@/lib/server/motion-studio/agent-bridge'
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    return NextResponse.json(await botParentArtifacts(id,request))
  } catch (err) { return motionStudioJsonError(err) }
}
