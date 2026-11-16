import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botProgress } from '@/lib/server/motion-studio/agent-bridge'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params
    return NextResponse.json({ job: await botProgress(id, request, await request.json()) })
  } catch (err) { return motionStudioJsonError(err) }
}
