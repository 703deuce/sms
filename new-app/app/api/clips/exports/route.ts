import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET() {
  try {
    const workspaceId = await resolveWorkspaceId()
    const prisma = getPrisma()
    const rows = await prisma.clipRender.findMany({
      where: { workspaceId, status: 'READY' },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { clip: { select: { title: true, projectId: true } } },
    })
    const storage = getClipStorage()
    const exports = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        clipId: r.clipId,
        projectId: r.clip.projectId,
        title: r.clip.title,
        filename: r.filename,
        watermark: r.watermark,
        createdAt: r.createdAt.toISOString(),
        downloadUrl: r.outputKey ? await storage.createSignedDownloadUrl(r.outputKey, 3600) : null,
      })),
    )
    return NextResponse.json({ data: { exports } })
  } catch (err) {
    return jsonError(err, 500)
  }
}
