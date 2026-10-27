import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getCompositionRender } from '@/lib/server/clips/composition-export'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { resolveWorkspaceId } from '@/lib/server/workspace'

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ compositionId: string; renderId: string }> },
) {
  try {
    const workspaceId = await resolveWorkspaceId()
    const { compositionId, renderId } = await ctx.params
    const render = await getCompositionRender(workspaceId, compositionId, renderId)
    if (!render) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    let downloadUrl: string | null = null
    if (render.status === 'READY' && render.outputKey) {
      const storage = getClipStorage()
      downloadUrl = await createCachedSignedDownloadUrl(storage, render.outputKey, {
        downloadFilename: 'export.mp4',
      })
    }
    return NextResponse.json({
      id: render.id,
      status: render.status,
      downloadUrl,
      error: render.error,
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
