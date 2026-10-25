import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { abortClipUpload } from '@/lib/server/clips/uploads'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    await abortClipUpload(workspaceId, id)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
