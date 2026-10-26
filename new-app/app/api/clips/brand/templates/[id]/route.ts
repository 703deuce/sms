import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const row = await prisma.clipBrandTemplate.findFirst({ where: { id, workspaceId } })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await prisma.clipBrandTemplate.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return jsonError(err, 400)
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const action = new URL(request.url).searchParams.get('action')
    const prisma = getPrisma()
    if (action === 'set-default') {
      await prisma.$transaction([
        prisma.clipBrandTemplate.updateMany({ where: { workspaceId }, data: { isDefault: false } }),
        prisma.clipBrandTemplate.updateMany({ where: { id, workspaceId }, data: { isDefault: true } }),
      ])
      return NextResponse.json({ data: { ok: true } })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    return jsonError(err, 400)
  }
}
