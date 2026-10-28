import { NextResponse } from 'next/server'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
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
    const prisma = (await import('@/lib/server/db')).getPrisma()
    const clip = await prisma.clip.findUnique({ where: { id: render.clipId } })
    const activeJob = await prisma.clipJob.findFirst({
      where: {
        clipId: render.clipId,
        type: 'RENDER_CLIP',
        status: { in: ['QUEUED', 'RUNNING'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    })
    const jobPayload = activeJob?.payload as {
      clipperWatchdog?: { phase?: string; progress?: number }
      renderEtaSeconds?: number
    } | null
    const wd = jobPayload?.clipperWatchdog
    const filename = render.filename || exportFilename(clip?.title || 'clip')
    const durationMs = clip ? outputDurationMs(normalizeEdits(clip.edits, { clipStartMs: clip.startMs, clipEndMs: clip.endMs })) : null
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
        progress: typeof wd?.progress === 'number' ? wd.progress : render.status === 'RENDERING' ? 5 : null,
        phase: wd?.phase ?? (render.status === 'RENDERING' ? 'render_clip' : null),
        etaSec: typeof jobPayload?.renderEtaSeconds === 'number' ? jobPayload.renderEtaSeconds : null,
      },
    })
  } catch (err) {
    console.error('[clipper:export] render_status_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return jsonError(err, 500)
  }
}
