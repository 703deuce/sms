import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botPostMessage } from '@/lib/server/motion-studio/agent-bridge'
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    return NextResponse.json({ message: await botPostMessage(id,request,await request.json()) })
  } catch (err) { return motionStudioJsonError(err) }
}
