import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { addAssets } from '@/lib/server/motion-studio/service'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body: unknown = await request.json().catch(() => ({}))
    return NextResponse.json({ assets: await addAssets(await resolveWorkspaceId(), id, body) })
  } catch (err) { return motionStudioJsonError(err) }
}
