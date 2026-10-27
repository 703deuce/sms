import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { exportFilename } from '@/lib/server/clips/clips'
import { getRenderForWorkspace } from '@/lib/server/clips/renders'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
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
    const durationMs = clip ? clip.endMs - clip.startMs : null
    let downloadUrl: string | null = null
    if (render.status === 'READY' && render.outputKey) {
      downloadUrl = await createCachedSignedDownloadUrl(storage, render.outputKey, { downloadFilename: filename })
    }
    if (render.status === 'READY' && downloadUrl) {
      console.info('[clipper:export] render_ready', {
        renderId: render.id,
        clipId: render.clipId,
        filename,
        durationMs,
      })
    }
    return NextResponse.json({
      data: {
        id: render.id,
        status: render.status,
        downloadUrl,
        filename,
        error: render.error,
        durationMs,
        sizeBytes: render.sizeBytes != null ? Number(render.sizeBytes) : null,
      },
    })
  } catch (err) {
    console.error('[clipper:export] render_status_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return jsonError(err, 500)
  }
}
