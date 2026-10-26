import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { retryFailedRender } from '@/lib/server/clips/renders'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { id } = await ctx.params
    const data = await retryFailedRender(workspaceId, id)
    return NextResponse.json({ data })
  } catch (err) {
    return jsonError(err, 400)
  }
}
