import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { makeClipFromFullVideoRange } from '@/lib/server/clips/make-clip-from-range'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id: projectId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const body = (await request.json()) as {
      startMs: number
      endMs: number
      title?: string
      reasonTag?: string
      score?: number
      why?: string
      findJobId?: string
    }
    const result = await makeClipFromFullVideoRange(workspaceId, projectId, body)
    if (!result) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 400)
  }
}
