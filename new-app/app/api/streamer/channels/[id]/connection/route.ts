import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import {
  decryptKickToken,
  deleteKickEventSubscriptions,
  revokeKickToken,
} from '@/lib/server/streamer/kick'
import {
  decryptTwitchToken,
  deleteTwitchEventsubSubscriptions,
  revokeTwitchToken,
} from '@/lib/server/streamer/twitch'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const ch = await prisma.streamChannel.findFirst({ where: { id, workspaceId, deletedAt: null } })
    if (!ch) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const ps = (ch.platformState as Record<string, unknown>) || {}
    if (ch.platform === 'twitch') {
      const subIds = Array.isArray(ps.eventsubIds) ? (ps.eventsubIds as string[]) : []
      if (subIds.length) await deleteTwitchEventsubSubscriptions(subIds).catch(() => undefined)
    }
    if (ch.platform === 'kick') {
      const subIds = Array.isArray(ps.kickSubIds) ? (ps.kickSubIds as string[]) : []
      if (subIds.length) await deleteKickEventSubscriptions(subIds).catch(() => undefined)
    }
    if (ch.connectionId) {
      const conn = await prisma.integrationConnection.findUnique({ where: { id: ch.connectionId } })
      const token = decryptTwitchToken(conn?.accessToken) || decryptKickToken(conn?.accessToken)
      if (token) {
        if (ch.platform === 'twitch') await revokeTwitchToken(token).catch(() => undefined)
        if (ch.platform === 'kick') await revokeKickToken(token).catch(() => undefined)
      }
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
