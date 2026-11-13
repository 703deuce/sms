import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/server/api-error'
import { getPrisma } from '@/lib/server/db'
import { resolveWorkspaceId } from '@/lib/server/workspace'
import { t2vFeatureDisabledResponse } from '@/lib/server/t2v/t2v-api-guard'
import {
  advanceT2vPipeline,
  hasT2vPipelineDriver,
  kickT2vPipeline,
  pipelineProgress,
} from '@/lib/server/t2v/pipeline/t2v-orchestrator'
import { getClipStorage } from '@/lib/storage'
import { createCachedSignedDownloadUrl } from '@/lib/storage/signed-download-cache'
import { T2V_PIPELINE_STAGES } from '@/lib/t2v/pipeline/t2v-types'
import type { T2vDraftV1 } from '@/lib/t2v/types'

export async function GET(_request: Request, ctx: { params: Promise<{ draftId: string }> }) {
  const disabled = t2vFeatureDisabledResponse()
  if (disabled) return disabled
  try {
    const workspaceId = await resolveWorkspaceId()
    const { draftId } = await ctx.params
    const prisma = getPrisma()
    let row = await prisma.t2vDraft.findFirst({ where: { id: draftId, workspaceId } })
    if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    let run = (row.document as T2vDraftV1).autobuild
    if (!run) return NextResponse.json({ error: 'not_a_pipeline_run' }, { status: 404 })
    if (run.status !== 'done' && run.status !== 'failed') {
      if (!hasT2vPipelineDriver(draftId)) {
        // Web process restarted: resume the server-side driver from the persisted stage.
        kickT2vPipeline(draftId, { resumed: true })
      } else {
        await advanceT2vPipeline(draftId)
      }
      row = (await prisma.t2vDraft.findFirst({ where: { id: draftId, workspaceId } }))!
      run = (row.document as T2vDraftV1).autobuild!
    }
    let video: { status: string; progress: number | null; downloadUrl: string | null; outputDurationMs: number | null } | null = null
    if (run.renderId && run.compositionId) {
      const render = await prisma.scriptCompositionRender.findUnique({ where: { id: run.renderId } })
      if (render) {
        const settings = (render.settings ?? {}) as Record<string, unknown>
        let downloadUrl: string | null = null
        if (render.status === 'READY' && render.outputKey) {
          downloadUrl = await createCachedSignedDownloadUrl(getClipStorage(), render.outputKey, {
            downloadFilename: `${(row.document as T2vDraftV1).title || 'video'}.mp4`.replace(/[^\w .-]/g, ''),
          })
        }
        video = {
          status: render.status,
          progress: typeof settings.progress === 'number' ? settings.progress : null,
          downloadUrl,
          outputDurationMs: typeof settings.outputDurationMs === 'number' ? settings.outputDurationMs : null,
        }
      }
    }
    const stages = T2V_PIPELINE_STAGES.map((s) => ({
      id: s.id,
      label: s.label,
      state: run!.completed.includes(s.id) ? 'done' : run!.status === s.id ? 'active' : 'pending',
    }))
    const { candidates: _c, ...runLite } = run
    void _c
    return NextResponse.json({
      data: {
        draftId,
        projectId: row.projectId,
        title: (row.document as T2vDraftV1).title,
        status: run.status,
        error: run.error ?? null,
        progress: pipelineProgress(run),
        assembleStage: row.stage,
        assembleProgress: row.progress,
        stages,
        run: runLite,
        video,
      },
    })
  } catch (err) {
    return jsonError(err, 500)
  }
}
