import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const m = await prisma.clipMontage.findFirst({ where: { id, workspaceId, deletedAt: null } })
    if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const storage = getClipStorage()
    return NextResponse.json({
      data: {
        id: m.id,
        title: m.title,
        status: m.status,
        outputUrl: m.outputKey ? await storage.createSignedDownloadUrl(m.outputKey, 3600) : null,
        posterUrl: m.posterKey ? await storage.createSignedDownloadUrl(m.posterKey, 3600) : null,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    await prisma.clipMontage.updateMany({
      where: { id, workspaceId },
      data: { deletedAt: new Date() },
    })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
