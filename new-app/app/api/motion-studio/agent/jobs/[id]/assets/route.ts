import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botAssets } from '@/lib/server/motion-studio/agent-bridge'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json(await botAssets(id, request, await request.json()))
  } catch (err) { return motionStudioJsonError(err) }
}
