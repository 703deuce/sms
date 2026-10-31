import { NextResponse } from 'next/server'
import { assertDevApiAccess } from '@/lib/server/dev-api-guard'
import { jsonError } from '@/lib/server/api-error'
import { deleteLut } from '@/lib/server/clips/luts'
import { resolveWorkspaceId } from '@/lib/server/workspace'

/** G4a: soft-delete a workspace LUT (it leaves the picker; projects that use it still render). */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = assertDevApiAccess(request)
  if (denied) return denied
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    if (!(await deleteLut(workspaceId, id))) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}
