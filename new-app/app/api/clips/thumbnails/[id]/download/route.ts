import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getClipStorage } from '@/lib/storage'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const row = await prisma.clipThumbnail.findFirst({
      where: { id, workspaceId },
    })
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    let key = row.imageKey
    if (!key && row.generationId) {
      const gen = await prisma.aiGeneration.findFirst({
        where: { id: row.generationId, workspaceId },
        select: { storageKey: true },
      })
      key = gen?.storageKey ?? null
    }
    if (!key) return NextResponse.json({ error: 'Not ready' }, { status: 404 })
    const storage = getClipStorage()
    const url = await storage.createSignedDownloadUrl(key, 300, {
      downloadFilename: `${(row.titleText || 'thumbnail').replace(/[^\w.-]+/g, '_')}.png`,
    })
    return NextResponse.redirect(url)
  } catch (err) {
    return jsonError(err, 500)
  }
}
