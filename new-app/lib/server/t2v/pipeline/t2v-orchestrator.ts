import 'server-only'
import { Prisma } from '@prisma/client'
import { getPrisma } from '@/lib/server/db'
import { createId } from '@/lib/supabase/id'
import { createT2vDraft, enqueueT2vAssemble, saveT2vDraft } from '@/lib/server/t2v/drafts'
import { enqueueCompositionExport } from '@/lib/server/clips/composition-export'
import { defaultT2vDraft } from '@/lib/t2v/defaults'
import { DEFAULT_T2V_VOICE } from '@/lib/t2v/voice-defaults'
import { logT2v, logT2vError } from '@/lib/server/t2v/log'
import type { T2vAspect, T2vDraftV1 } from '@/lib/t2v/types'
import {
  T2V_PIPELINE_DEFAULT_NARRATOR,
  T2V_PIPELINE_NARRATORS,
  type T2vPipelineRun,
  type T2vPipelineStageId,
  type T2vPipelineStatus,
  type T2vPipelineStyle,
  type T2vShotResult,
} from '@/lib/t2v/pipeline/t2v-types'
import { t2vScriptAgent, t2vStoryAgent } from '@/lib/server/t2v/pipeline/t2v-story-agent'
import { t2vScenePlanner } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { t2vFootageAgent } from '@/lib/server/t2v/pipeline/t2v-footage-agent'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { t2vQaPlan, t2vQaRender } from '@/lib/server/t2v/pipeline/t2v-qa'

/**
 * Prompt-to-Video orchestrator (Text-to-Video's own pipeline; nothing shared with the YouTube maker).
 *
 * Web-owned steps (LLM agents, stock search, finisher, QA) run in this process. Media steps run on
 * the clips worker (T2V_VERIFY_STOCK → T2V_ASSEMBLE → RENDER_SCRIPT_COMPOSITION). A server-side
 * driver ticks the run, so it advances without a browser; status polls and worker callbacks also
 * tick it. Every tick is idempotent. Paid steps are never retried automatically in a loop.
 */

const TICK_MS = 8_000
const DRIVER_MAX_MS = 60 * 60_000
const MUSIC_WAIT_MS = 5 * 60_000
const WEB_STAGES: T2vPipelineStatus[] = ['writing_script', 'planning_scenes', 'finding_footage']
const MAX_RESUMES = 1

const drivers = new Map<string, { timer: ReturnType<typeof setInterval>; startedAt: number }>()
const advancing = new Set<string>()

export type StartT2vPipelineInput = {
  prompt: string
  style: T2vPipelineStyle
  durationS: number
  aspect: T2vAspect
  voiceId?: string
  captions: boolean
  renderResolution: '480p' | '720p' | '1080p'
}

const STYLE_TONE: Record<T2vPipelineStyle, T2vDraftV1['settings']['tone']> = {
  documentary: 'calm',
  educational: 'friendly',
  explainer: 'friendly',
  marketing: 'professional',
  social: 'energetic',
}

export async function startT2vPipeline(workspaceId: string, input: StartT2vPipelineInput) {
  const narrator = T2V_PIPELINE_NARRATORS.find((n) => n.voiceId === input.voiceId) ?? T2V_PIPELINE_DEFAULT_NARRATOR
  const doc = defaultT2vDraft({
    sourceKind: 'prompt',
    text: input.prompt,
    settings: {
      aspect: input.aspect,
      targetDurationS: input.durationS,
      tone: STYLE_TONE[input.style],
      platform: input.aspect === '9:16' ? 'youtube_shorts' : 'youtube',
      sceneSplit: 'ai',
      captionsEnabled: input.captions,
    },
  })
  doc.title = input.prompt.slice(0, 60)
  doc.voice = { ...DEFAULT_T2V_VOICE, voiceId: narrator.voiceId, voiceName: narrator.name }
  doc.music = { volume: 0.18, duck: true }
  const now = new Date().toISOString()
  doc.autobuild = {
    v: 1,
    prompt: input.prompt,
    style: input.style,
    durationS: input.durationS,
    renderResolution: input.renderResolution,
    status: 'queued',
    completed: [],
    log: [{ stage: 'queued', at: now }],
    startedAt: now,
  }
  const draft = await createT2vDraft(workspaceId, doc)
  await getPrisma().t2vDraft.update({
    where: { id: draft.id },
    data: { status: 'AUTOBUILDING', stage: 'queued', progress: 0 },
  })
  logT2v('pipeline', 'run created', { draftId: draft.id, projectId: draft.projectId, durationS: input.durationS, style: input.style })
  kickT2vPipeline(draft.id)
  return { draftId: draft.id, projectId: draft.projectId }
}

/** Start (or keep) the in-process driver for a run. Safe to call repeatedly. */
export function kickT2vPipeline(draftId: string, opts: { resumed?: boolean } = {}) {
  if (drivers.has(draftId)) return
  const startedAt = Date.now()
  const timer = setInterval(() => {
    if (Date.now() - startedAt > DRIVER_MAX_MS) {
      stopDriver(draftId)
      return
    }
    void advanceT2vPipeline(draftId)
  }, TICK_MS)
  drivers.set(draftId, { timer, startedAt })
  void advanceT2vPipeline(draftId, opts)
}

function stopDriver(draftId: string) {
  const d = drivers.get(draftId)
  if (d) clearInterval(d.timer)
  drivers.delete(draftId)
}

export function hasT2vPipelineDriver(draftId: string): boolean {
  return drivers.has(draftId)
}

type Row = { id: string; workspaceId: string; projectId: string; document: T2vDraftV1; revision: number; status: string; stage: string | null; assembledRevision: number | null; error: string | null }

async function loadRow(draftId: string): Promise<Row | null> {
  const r = await getPrisma().t2vDraft.findUnique({ where: { id: draftId } })
  if (!r) return null
  return { ...r, document: r.document as T2vDraftV1 }
}

/** Write only document.autobuild (no revision bump — the storyboard must not look edited). */
async function writeRun(draftId: string, mutate: (run: T2vPipelineRun) => T2vPipelineRun, draftCols?: Prisma.T2vDraftUpdateInput) {
  const row = await loadRow(draftId)
  if (!row?.document.autobuild) throw new Error('t2v_pipeline_run_missing')
  const run = mutate(structuredClone(row.document.autobuild))
  const doc = { ...row.document, autobuild: run }
  await getPrisma().t2vDraft.update({
    where: { id: draftId },
    data: { document: doc as unknown as Prisma.InputJsonValue, ...(draftCols ?? {}) },
  })
  return run
}

function progressFor(status: T2vPipelineStatus): number {
  const order: T2vPipelineStatus[] = ['queued', 'writing_script', 'planning_scenes', 'finding_footage', 'verifying_footage', 'generating_narration', 'editing_video', 'rendering', 'done']
  const i = order.indexOf(status)
  return i < 0 ? 0 : Math.round((i / (order.length - 1)) * 100)
}

function moveTo(run: T2vPipelineRun, done: T2vPipelineStageId | null, next: T2vPipelineStatus, note?: string): T2vPipelineRun {
  if (done && !run.completed.includes(done)) run.completed.push(done)
  run.status = next
  run.log.push({ stage: next, at: new Date().toISOString(), ...(note ? { note } : {}) })
  if (next === 'done') run.finishedAt = new Date().toISOString()
  return run
}

async function setStage(draftId: string, done: T2vPipelineStageId | null, next: T2vPipelineStatus, extra?: (r: T2vPipelineRun) => void, note?: string) {
  return writeRun(
    draftId,
    (r) => {
      extra?.(r)
      return moveTo(r, done, next, note)
    },
    next === 'done' ? undefined : { stage: `pipeline:${next}` },
  )
}

async function failRun(draftId: string, error: string) {
  logT2v('pipeline', 'run failed', { draftId, error })
  await writeRun(
    draftId,
    (r) => {
      r.error = error
      return moveTo(r, null, 'failed', error)
    },
    { status: 'FAILED', error: error.slice(0, 500) },
  )
  stopDriver(draftId)
}

async function enqueuePipelineMusic(row: Row, run: T2vPipelineRun, mood: string): Promise<string> {
  const prisma = getPrisma()
  const lengthMs = Math.min(600_000, Math.max(15_000, (run.durationS + 6) * 1000))
  const prompt = `${mood}, subtle instrumental background bed for a ${run.style} video narration, no vocals, steady, unobtrusive`
  const gen = await prisma.aiGeneration.create({
    data: {
      workspaceId: row.workspaceId,
      kind: 'MUSIC',
      status: 'PENDING',
      provider: 'elevenlabs',
      prompt,
      params: { instrumental: true, lengthMs, t2vProjectId: row.projectId, draftId: row.id, pipeline: 'prompt_to_video' },
    },
  })
  await prisma.clipJob.create({
    data: {
      id: createId('job'),
      projectId: row.projectId,
      type: 'MUSIC',
      status: 'QUEUED',
      payload: { generationId: gen.id, lengthMs, instrumental: true, prompt, t2vProjectId: row.projectId },
    },
  })
  return gen.id
}

export async function advanceT2vPipeline(draftId: string, opts: { resumed?: boolean } = {}): Promise<void> {
  if (advancing.has(draftId)) return
  advancing.add(draftId)
  try {
    await advanceOnce(draftId, opts)
  } catch (err) {
    logT2vError('pipeline', 'tick failed', err, { draftId })
    await failRun(draftId, err instanceof Error ? err.message.slice(0, 300) : 'pipeline_error').catch(() => {})
  } finally {
    advancing.delete(draftId)
  }
}

async function advanceOnce(draftId: string, opts: { resumed?: boolean }) {
  const prisma = getPrisma()
  const row = await loadRow(draftId)
  const run = row?.document.autobuild
  if (!row || !run) return stopDriver(draftId)
  if (run.status === 'done' || run.status === 'failed') return stopDriver(draftId)

  if (opts.resumed && WEB_STAGES.includes(run.status)) {
    // A web restart interrupted a web-owned step. Allow one bounded re-run, never a loop.
    if ((run.resumes ?? 0) >= MAX_RESUMES) return failRun(draftId, `interrupted_during_${run.status}`)
    await writeRun(draftId, (r) => ({ ...r, resumes: (r.resumes ?? 0) + 1 }))
  }

  const doc = row.document
  switch (run.status) {
    case 'queued':
    case 'writing_script': {
      if (run.status === 'queued') await setStage(draftId, null, 'writing_script')
      const story = await t2vStoryAgent({ prompt: run.prompt, style: run.style, durationS: run.durationS })
      const segments = await t2vScriptAgent({ story, style: run.style, durationS: run.durationS, prompt: run.prompt })
      await setStage(draftId, 'writing_script', 'planning_scenes', (r) => {
        r.story = story
        r.segments = segments
      })
      logT2v('pipeline', 'script written', { draftId, segments: segments.length, words: segments.reduce((n, s) => n + s.narration.split(/\s+/).length, 0) })
      return advanceOnce(draftId, {})
    }
    case 'planning_scenes': {
      const shots = await t2vScenePlanner({ story: run.story!, segments: run.segments! })
      const musicGenerationId = await enqueuePipelineMusic(row, run, run.story!.musicMood)
      const fresh = (await loadRow(draftId))!
      const nextDoc: T2vDraftV1 = {
        ...fresh.document,
        title: run.story!.title,
        music: { volume: 0.18, duck: true, generationId: musicGenerationId, assetId: musicGenerationId, label: run.story!.musicMood, prompt: run.story!.musicMood },
      }
      await prisma.t2vDraft.update({ where: { id: draftId }, data: { document: nextDoc as unknown as Prisma.InputJsonValue } })
      await prisma.clipProject.update({ where: { id: row.projectId }, data: { title: run.story!.title } }).catch(() => {})
      await setStage(draftId, 'planning_scenes', 'finding_footage', (r) => {
        r.shots = shots
        r.musicGenerationId = musicGenerationId
      })
      logT2v('pipeline', 'scenes planned', { draftId, shots: shots.length })
      return advanceOnce(draftId, {})
    }
    case 'finding_footage': {
      const candidates = await t2vFootageAgent({ shots: run.shots!, aspect: doc.settings.aspect })
      const jobId = createId('job')
      await prisma.clipJob.create({
        data: {
          id: jobId,
          projectId: row.projectId,
          type: 'T2V_VERIFY_STOCK',
          status: 'QUEUED',
          maxAttempts: 1,
          payload: {
            draftId,
            workspaceId: row.workspaceId,
            projectId: row.projectId,
            topic: run.story?.topic || run.story?.title || '',
            shots: run.shots!.map((s) => ({
              sceneId: s.sceneId,
              narration: s.narration,
              intent: s.intent,
              needS: s.needS,
              candidates: (candidates[s.sceneId] ?? []).map((c) => ({
                provider: c.provider,
                providerId: c.providerId,
                previewUrl: c.previewUrl,
                durationS: c.durationS,
                query: c.query,
              })),
            })),
          } as Prisma.InputJsonValue,
        },
      })
      await setStage(draftId, 'finding_footage', 'verifying_footage', (r) => {
        r.candidates = candidates
        r.verifyJobId = jobId
      })
      return
    }
    case 'verifying_footage': {
      const job = run.verifyJobId ? await prisma.clipJob.findUnique({ where: { id: run.verifyJobId } }) : null
      if (!job) return failRun(draftId, 'verify_job_missing')
      if (job.status === 'FAILED') return failRun(draftId, `verify_failed:${(job.error ?? '').slice(0, 120)}`)
      if (job.status !== 'DONE') return
      const payload = job.payload as { results?: T2vShotResult[]; summary?: Record<string, number | string> }
      const results = (payload.results ?? []).filter(Boolean) as T2vShotResult[]
      const fin = await t2vFinisher({
        workspaceId: row.workspaceId,
        doc,
        run,
        story: run.story!,
        segments: run.segments!,
        shots: run.shots!,
        results,
        candidates: run.candidates ?? {},
      })
      const qa = t2vQaPlan({ run, scenes: fin.scenes, results: fin.results })
      const fresh = (await loadRow(draftId))!
      const nextDoc: T2vDraftV1 = {
        ...fresh.document,
        scenes: fin.scenes,
        nextSlot: fin.scenes.length,
        autobuild: moveTo(
          { ...fresh.document.autobuild!, results: fin.results, verifySummary: payload.summary, qa: [...(fresh.document.autobuild!.qa ?? []), qa] },
          'verifying_footage',
          'generating_narration',
        ),
      }
      await saveT2vDraft(row.workspaceId, draftId, fresh.revision, nextDoc)
      await prisma.t2vDraft.update({ where: { id: draftId }, data: { stage: 'pipeline:generating_narration' } })
      logT2v('pipeline', 'edit built', { draftId, scenes: fin.scenes.length, qaPass: qa.pass, ...payload.summary })
      return advanceOnce(draftId, {})
    }
    case 'generating_narration':
    case 'editing_video': {
      if (!run.assembleJobId) {
        if (run.musicGenerationId) {
          const gen = await prisma.aiGeneration.findUnique({ where: { id: run.musicGenerationId }, select: { status: true } })
          const since = Date.parse(run.log.find((l) => l.stage === 'finding_footage')?.at ?? run.startedAt)
          if (gen?.status === 'PENDING' || gen?.status === 'RUNNING') {
            if (Date.now() - since < MUSIC_WAIT_MS) return
          }
          if (gen?.status !== 'READY') {
            // Continue without music rather than block the video; recorded on the run.
            const fresh = (await loadRow(draftId))!
            await saveT2vDraft(row.workspaceId, draftId, fresh.revision, { ...fresh.document, music: { volume: 0.18, duck: true, disabled: true } })
            await writeRun(draftId, (r) => {
              r.log.push({ stage: r.status, at: new Date().toISOString(), note: `music_unavailable:${gen?.status ?? 'missing'}` })
              return r
            })
          }
        }
        const { jobId } = await enqueueT2vAssemble(row.workspaceId, draftId)
        await writeRun(draftId, (r) => ({ ...r, assembleJobId: jobId }))
        return
      }
      const job = await prisma.clipJob.findUnique({ where: { id: run.assembleJobId }, select: { status: true, error: true } })
      if (job?.status === 'FAILED' || row.status === 'FAILED') {
        return failRun(draftId, `assemble_failed:${(job?.error ?? row.error ?? '').slice(0, 160)}`)
      }
      const assembled = row.status === 'READY' && row.assembledRevision != null
      if (!assembled) {
        if (run.status === 'generating_narration' && (row.stage === 'assemble' || row.stage === 'upload')) {
          await setStage(draftId, 'generating_narration', 'editing_video')
        }
        return
      }
      const comp = await prisma.scriptComposition.findFirst({
        where: { projectId: row.projectId, kind: 'FULL', clipId: null, deletedAt: null },
        select: { id: true },
      })
      if (!comp) return failRun(draftId, 'composition_missing_after_assemble')
      await pinCompositionFraming(comp.id)
      const exp = await enqueueCompositionExport(row.workspaceId, comp.id, {
        exportKind: 'video',
        resolution: run.renderResolution,
        quality: 'recommended',
        burnCaptions: doc.settings.captionsEnabled,
        includeSubtitleTrack: false,
        includeMarkersAsChapters: false,
      })
      if (!exp) return failRun(draftId, 'export_enqueue_failed')
      await writeRun(
        draftId,
        (r) => {
          if (!r.completed.includes('generating_narration')) r.completed.push('generating_narration')
          r.compositionId = comp.id
          r.renderId = exp.renderId
          return moveTo(r, 'editing_video', 'rendering')
        },
        { status: 'AUTOBUILDING', stage: 'pipeline:rendering' },
      )
      return
    }
    case 'rendering': {
      const render = run.renderId ? await prisma.scriptCompositionRender.findUnique({ where: { id: run.renderId } }) : null
      if (!render) return failRun(draftId, 'render_missing')
      if (render.status === 'FAILED' || render.status === 'CANCELED') return failRun(draftId, `render_failed:${(render.error ?? '').slice(0, 160)}`)
      if (render.status !== 'READY') return
      const settings = (render.settings ?? {}) as Record<string, unknown>
      const project = await prisma.clipProject.findUnique({ where: { id: row.projectId }, select: { rangeEndMs: true } })
      const qa = t2vQaRender({
        run,
        status: render.status,
        outputDurationMs: typeof settings.outputDurationMs === 'number' ? settings.outputDurationMs : null,
        sourceDurationMs: project?.rangeEndMs ?? null,
        hasOutput: Boolean(render.outputKey),
      })
      await writeRun(
        draftId,
        (r) => {
          r.qa = [...(r.qa ?? []), qa]
          return moveTo(r, 'rendering', 'done')
        },
        { status: 'READY', stage: 'done', progress: 100 },
      )
      logT2v('pipeline', 'run done', { draftId, qaPass: qa.pass })
      stopDriver(draftId)
      return
    }
  }
}

/**
 * The assembled T2V source is already framed at the target aspect. Without an explicit reframe mode the
 * composition export falls back to speaker_follow (face-follow crop), which zoomed and panned run 1's
 * title cards. center_crop at the same aspect is a plain full-frame scale. Only set when absent, so a
 * user's later choice in the editor wins.
 */
async function pinCompositionFraming(compositionId: string) {
  const prisma = getPrisma()
  const comp = await prisma.scriptComposition.findUnique({ where: { id: compositionId }, select: { document: true } })
  const doc = (comp?.document ?? {}) as { settings?: Record<string, unknown> }
  if (!comp || doc.settings?.reframeMode) return
  const next = { ...doc, settings: { ...(doc.settings ?? {}), reframeMode: 'center_crop' } }
  await prisma.scriptComposition.update({
    where: { id: compositionId },
    data: { document: next as unknown as Prisma.InputJsonValue, revision: { increment: 1 } },
  })
}

export function pipelineProgress(run: T2vPipelineRun): number {
  return progressFor(run.status)
}
