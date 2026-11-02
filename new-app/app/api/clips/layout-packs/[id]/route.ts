import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { layoutPackPayloadSchema } from '@/lib/clips/layout-packs'

export const dynamic = 'force-dynamic'
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const row = await getPrisma().layoutPack.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({
      data: { pack: { ...row, payload: layoutPackPayloadSchema.parse(row.payload) } },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const r = await getPrisma().layoutPack.deleteMany({ where: { id, workspaceId } })
    if (r.count === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ data: { deleted: id } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
