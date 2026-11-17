import { NextResponse } from 'next/server'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { botGetCheckpoint, botSaveCheckpoint } from '@/lib/server/motion-studio/agent-bridge'

type Ctx = { params: Promise<{ id: string }> }
export async function GET(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    return NextResponse.json(await botGetCheckpoint(id, request))
  } catch (error) { return motionStudioJsonError(error) }
}
export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    return NextResponse.json(await botSaveCheckpoint(id, request, await request.json()))
  } catch (error) { return motionStudioJsonError(error) }
}
