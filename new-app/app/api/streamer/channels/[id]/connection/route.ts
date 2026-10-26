import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const ch = await prisma.streamChannel.findFirst({ where: { id, workspaceId, deletedAt: null } })
    if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (ch.connectionId) {
      await prisma.integrationConnection.updateMany({
        where: { id: ch.connectionId },
        data: { status: 'disconnected', accessToken: null, refreshToken: null },
      })
    }
    await prisma.streamChannel.update({
      where: { id },
      data: { status: 'DISCONNECTED', autoProcess: false, connectionId: null, platformState: {} },
    })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
