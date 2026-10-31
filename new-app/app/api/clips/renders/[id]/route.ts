import { NextResponse } from 'next/server'
import { normalizeEdits, outputDurationMs } from '@/lib/clips/edits'
import { jsonError } from '@/lib/server/api-error'
import { exportFilename } from '@/lib/server/clips/clips'
import { getRenderForWorkspace } from '@/lib/server/clips/renders'
import { getClipStorage } from '@/lib/storage'
import { readRenderDetail } from '@/lib/clips/editor/export-progress-text'
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
    const activeWhere = {
      clipId: render.clipId,
      type: 'RENDER_CLIP',
      status: { in: ['QUEUED', 'RUNNING'] },
    }
    // E6: progress must come from THIS render's job — with two exports of one clip in flight the
    // newest-by-clip job reported the other export's percentage.
    const activeJob =
      render.status === 'READY' || render.status === 'FAILED'
        ? null
        : ((await prisma.clipJob.findFirst({
            where: { ...activeWhere, payload: { path: ['renderId'], equals: render.id } },
            orderBy: { createdAt: 'desc' },
            select: { payload: true },
          })) ??
          (await prisma.clipJob.findFirst({
            where: activeWhere,
            orderBy: { createdAt: 'desc' },
            select: { payload: true },
          })))
    const jobPayload = activeJob?.payload as {
      clipperWatchdog?: { phase?: string; progress?: number }
      renderEtaSeconds?: number | null
      renderDetail?: unknown
    } | null
    const wd = jobPayload?.clipperWatchdog
    const filename = render.filename || exportFilename(clip?.title || 'clip')
    const durationMs = clip ? outputDurationMs(normalizeEdits(clip.edits, { clipStartMs: clip.startMs, clipEndMs: clip.endMs })) : null
    let downloadUrl: string | null = null
    let downloadPending = false
    if (render.status === 'READY' && render.outputKey) {
      // E6: a signing hiccup used to 500 the whole poll, so the dialog never saw READY and sat at
      // the worker's last pre-upload 82% until reload. Report READY and let the client re-poll.
      try {
        downloadUrl = await createCachedSignedDownloadUrl(storage, render.outputKey, {
          downloadFilename: filename,
          versionHint: `render:${render.id}:${render.sizeBytes != null ? String(render.sizeBytes) : ''}`,
        })
      } catch (signErr) {
        downloadPending = true
        console.warn('[clipper:export] render_sign_failed', {
          renderId: render.id,
          message: signErr instanceof Error ? signErr.message : String(signErr),
        })
      }
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
        downloadPending,
        progress:
          render.status === 'READY'
            ? 100
            : typeof wd?.progress === 'number'
              ? wd.progress
              : render.status === 'RENDERING'
                ? 5
                : null,
        phase: wd?.phase ?? (render.status === 'RENDERING' ? 'render_clip' : null),
        etaSec: typeof jobPayload?.renderEtaSeconds === 'number' ? jobPayload.renderEtaSeconds : null,
        // FV4a: real progress detail (step k of ~N, % of the current pass) from the worker.
        detail: render.status === 'RENDERING' ? readRenderDetail(jobPayload?.renderDetail) : null,
      },
    })
  } catch (err) {
    console.error('[clipper:export] render_status_failed', {
      message: err instanceof Error ? err.message : String(err),
    })
    return jsonError(err, 500)
  }
}
