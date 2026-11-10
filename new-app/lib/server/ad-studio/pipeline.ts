import 'server-only'
import { getPrisma } from '@/lib/server/db'
import type { AdProductInput } from '@/lib/ad-studio/types'
import { ensureAdImageVariants, advanceAdImageVariants, listAdImageVariants } from './image-variants'
import { advanceAdStudioGeneration } from './queue'
import { ensureAdVoiceover } from './voiceover'
import { ensureAdDestinationProject, ensureAdEditorClip, advanceAdRender } from './destination'

export const getAdStudioImages = listAdImageVariants

/** GET/confirm refresh tick: bounded KIE jobs, then editor materialization and a single render. */
export async function advanceAdStudioRun(workspaceId: string, runId: string): Promise<void> {
  const db = getPrisma()
  let run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
  if (!run || !['generating','stitching'].includes(run.status)) return
  console.info('[ad-studio:b3] run_tick_begin', { runId, status: run.status, projectId: run.projectId, clipId: run.clipId })
  try {
    if (run.status === 'generating') {
      await ensureAdImageVariants(runId, run.input as unknown as AdProductInput)
      const video = await advanceAdStudioGeneration(workspaceId, runId)
      if (video.state === 'failed') return
      const images = await advanceAdImageVariants(workspaceId, runId)
      if (images === 'failed') return
      console.info('[ad-studio:b3] generation_progress', { runId, videoState: video.state, imagesState: images, submitted: video.submitted })
      if (video.state !== 'ready_for_stitch' || images !== 'ready') return
      await db.adStudioRun.updateMany({ where: { id: runId, workspaceId, status: 'generating' },
        data: { status: 'stitching' } })
      run = await db.adStudioRun.findFirst({ where: { id: runId, workspaceId } })
      console.info('[ad-studio:b3] status_transition', { runId, from: 'generating', to: run?.status })
    }
    if (run?.status !== 'stitching') return
    const canvas = await ensureAdDestinationProject(workspaceId, runId)
    if (canvas !== 'ready') return
    const voice = await ensureAdVoiceover(workspaceId, runId)
    if (voice.status === 'failed' || voice.status === 'pending') return
    const clipId = await ensureAdEditorClip(workspaceId, runId)
    if (!clipId) return
    await advanceAdRender(workspaceId, runId)
    console.info('[ad-studio:b3] run_tick_complete', { runId, canvas, voice: voice.status, clipId })
  } catch (err) {
    console.error('[ad-studio:b3] run_tick_failed', { runId, type: err instanceof Error ? err.name : typeof err })
    await db.adStudioRun.updateMany({
      where: { id: runId, workspaceId, status: { in: ['generating','stitching'] } },
      data: { status: 'failed', errorCode: 'STORAGE_ERROR',
        errorMessage: 'Ad Studio could not complete this step. No generation was automatically retried.' },
    })
  }
}
