import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { motionStudioJsonError } from '@/lib/server/motion-studio/http'
import { addAssets, listAssets } from '@/lib/server/motion-studio/service'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const result = await listAssets(workspaceId, id)
    return NextResponse.json({ assets: result })
  } catch (err) { return motionStudioJsonError(err) }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body: unknown = await request.json().catch(() => ({}))
    const result = await addAssets(workspaceId, id, body)
    console.info('[motion-studio:api:assets] ok', { projectId: id })
    return NextResponse.json({ project: result })
  } catch (err) { return motionStudioJsonError(err) }
}
