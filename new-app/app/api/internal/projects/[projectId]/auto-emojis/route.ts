import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { applyProjectAutoEmojis } from '@/lib/server/clips/caption-emojis'
import { verifyWorkerHmac } from '@/lib/server/clips/worker-auth'
import { getPrisma } from '@/lib/server/db'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request, ctx: { params: Promise<{ projectId: string }> }) {
  const raw = await request.text()
  if (!verifyWorkerHmac(request, raw)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { projectId } = await ctx.params
    const prisma = getPrisma()
    const project = await prisma.clipProject.findUnique({
      where: { id: projectId },
      select: { workspaceId: true },
    })
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const result = await applyProjectAutoEmojis(project.workspaceId, projectId)
    return NextResponse.json({ data: result })
  } catch (err) {
    return jsonError(err, 500)
  }
}
