import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { exportFilename } from '@/lib/server/clips/clips'
import { getRenderForWorkspace } from '@/lib/server/clips/renders'
import { getClipStorage } from '@/lib/storage'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const workspaceId = await resolveWorkspaceId()
    const render = await getRenderForWorkspace(workspaceId, id)
    if (!render) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const storage = getClipStorage()
    const clip = await import('@/lib/server/db').then((m) =>
      m.getPrisma().clip.findUnique({ where: { id: render.clipId } }),
    )
    const filename = render.filename || exportFilename(clip?.title || 'clip')
    let downloadUrl: string | null = null
    if (render.status === 'READY' && render.outputKey) {
      downloadUrl = await storage.createSignedDownloadUrl(render.outputKey, 3600, { downloadFilename: filename })
    }
    return NextResponse.json({
      data: {
        id: render.id,
        status: render.status,
        downloadUrl,
        filename,
        error: render.error,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
