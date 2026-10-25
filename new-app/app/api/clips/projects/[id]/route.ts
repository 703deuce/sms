import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { serializeProject } from '@/lib/server/clips/serialize'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const project = await prisma.clipProject.findFirst({ where: { id, workspaceId, deletedAt: null } })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ data: serializeProject(project) })
  } catch (err) {
    return jsonError(err, 500)
  }
}
