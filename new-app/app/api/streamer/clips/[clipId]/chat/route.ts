import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ clipId: string }> }) {
  try {
    const { clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const clip = await prisma.clip.findFirst({
      where: { id: clipId, workspaceId, deletedAt: null },
      select: { projectId: true },
    })
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const key = `ws/${workspaceId}/projects/${clip.projectId}/clips/${clipId}/chat.json`
    const storage = getClipStorage()
    try {
      const raw = await storage.getJson(key)
      return NextResponse.json({ data: raw })
    } catch {
      return NextResponse.json({ data: { lines: [] } })
    }
  } catch (err) {
    return jsonError(err, 500)
  }
}
