import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getClipForWorkspace } from '@/lib/server/clips/clips'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id: clipId } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const clip = await getClipForWorkspace(workspaceId, clipId)
    if (!clip) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const prisma = getPrisma()
    const rows = await prisma.dubTrack.findMany({
      where: { clipId },
      orderBy: { createdAt: 'desc' },
    })
    const storage = getClipStorage()
    const items = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        targetLang: r.targetLang,
        status: r.status,
        error: r.error,
        costUsdMicros: r.costUsdMicros,
        audioUrl: r.audioKey ? await storage.createSignedDownloadUrl(r.audioKey, 3600) : null,
        words: r.words,
      })),
    )
    return NextResponse.json({ data: { items } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
