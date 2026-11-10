import { NextResponse } from 'next/server'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { getPrisma } from '@/lib/server/db'
import { getClipStorageForObjectKey } from '@/lib/storage'
import { adStudioJsonError } from '@/lib/server/ad-studio/http'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  console.info('[ad-studio:api:final-render] begin')
  try {
    const { id } = await context.params
    const workspaceId = await resolveWorkspaceId()
    const run = await getPrisma().adStudioRun.findFirst({
      where: { id, workspaceId, status: 'done' },
      select: { id: true, renderId: true },
    })
    if (!run?.renderId) {
      return NextResponse.json({ code: 'RENDER_ERROR', error: 'Final render is not ready.' }, { status: 409 })
    }
    const render = await getPrisma().clipRender.findFirst({
      where: { id: run.renderId, workspaceId, status: 'READY' },
      select: { id: true, outputKey: true, filename: true },
    })
    if (!render?.outputKey) {
      return NextResponse.json({ code: 'RENDER_ERROR', error: 'Final render is not ready.' }, { status: 409 })
    }
    const download = new URL(request.url).searchParams.get('download') === '1'
    const filename = render.filename || 'ad-studio.mp4'
    const storage = await getClipStorageForObjectKey(render.outputKey)
    const url = await storage.createSignedDownloadUrl(
      render.outputKey,
      600,
      download ? { downloadFilename: filename } : undefined,
    )
    console.info('[ad-studio:api:final-render] complete', {
      runId: id, renderId: render.id, download, filename,
    })
    return NextResponse.json({ url, filename }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return adStudioJsonError(err)
  }
}
