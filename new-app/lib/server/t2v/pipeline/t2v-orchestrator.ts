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
  t2vRealisticStyle,
  type T2vPipelineRun,
  type T2vPipelineStageId,
  type T2vPipelineStatus,
  type T2vPipelineStyle,
  type T2vShotResult,
  type T2vPickedBy,
  type T2vFootageCandidate,
} from '@/lib/t2v/pipeline/t2v-types'
import { t2vScriptAgent, t2vStoryAgent } from '@/lib/server/t2v/pipeline/t2v-story-agent'
import { t2vScenePlanner } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { queryRewrites, t2vFootageAgent, t2vPhotoAgent } from '@/lib/server/t2v/pipeline/t2v-footage-agent'
import { t2vQueryRewriter } from '@/lib/server/t2v/pipeline/t2v-query-rewriter'
import { enforceNoRepeat, enforceNoRepeatDeterministic, t2vMonoRequested, t2vNightLine, t2vQualityOk } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { t2vQaPlan, t2vQaRender } from '@/lib/server/t2v/pipeline/t2v-qa'
import {
  AI_BROLL_EST_USD_PER_CLIP,
  AI_BROLL_MAX_CLIPS,
  AI_BROLL_MAX_NEED_S,
  aiBrollEnabled,
  aiBrollPrompts,
  aiBrollTargets,
  aiCandidate,
  aiFramesFor,
  pollAiClip,
  startAiClip,
  type T2vAiJob,
} from '@/lib/server/t2v/pipeline/t2v-ai-broll'

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
/** Extra search rounds (new adjacent queries) for shots where nothing passed review. */
const MAX_EXTRA_VERIFY_ROUNDS = 3

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
  /** Per-run AI B-roll test option (off by default). */
  aiBroll?: boolean
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
    ...(input.aiBroll ? { aiBroll: true } : {}),
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
  logT2v('pipeline', 'run created', { draftId: draft.id, projectId: draft.projectId, durationS: input.durationS, style: input.style, aiBroll: Boolean(input.aiBroll) })
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
      const shots = await t2vScenePlanner({ story: run.story!, segments: run.segments!, style: run.style, seed: `${draftId}:${run.startedAt}` })
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
      const topic = run.story?.topic || run.story?.title || ''
      const realistic = t2vRealisticStyle(run.style)
      const candidates = await t2vFootageAgent({ shots: run.shots!, aspect: doc.settings.aspect, topic, realistic })
      const jobId = await enqueueVerify(row, topic, run.shots!, candidates, { realistic, monoOk: t2vMonoRequested(run.prompt) })
      const tried: Record<string, string[]> = {}
      for (const sh of run.shots!) tried[sh.sceneId] = queryRewrites(sh.queries, topic)
      await setStage(draftId, 'finding_footage', 'verifying_footage', (r) => {
        r.candidates = candidates
        r.verifyJobId = jobId
        r.verifyRound = 0
        r.queriesTried = tried
      })
      return
    }
    case 'verifying_footage': {
      // AI B-roll test: wait for the generations, then send the finished clips to the same visual check.
      if (run.aiRound === 1) {
        const step = await aiBrollPoll(row, run)
        await writeRun(draftId, (r) => {
          r.aiJobs = step.jobs
          r.aiCostUsd = step.costUsd
          if (step.jobId) {
            r.verifyJobId = step.jobId
            r.candidates = step.candidates
          }
          if (step.done) {
            r.aiRound = 2
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `ai_broll:${step.ok}_clips_ok:$${step.costUsd.toFixed(3)}` })
            // No clip to check: hand straight back to the finisher with the stock picks.
            if (!step.jobId) r.verifyJobId = undefined
          }
          return r
        })
        if (!step.done) return
        if (step.jobId) return
        // Fall through on the next tick with stock only (no verify job).
        return advanceOnce(draftId, {})
      }
      const job = run.verifyJobId ? await prisma.clipJob.findUnique({ where: { id: run.verifyJobId } }) : null
      if (job && job.status !== 'DONE' && job.status !== 'FAILED') return
      // A missing/failed verify job never stalls the run: carry on with what earlier rounds found.
      const payload = (job?.status === 'DONE' ? job.payload : {}) as { results?: T2vShotResult[]; summary?: Record<string, number | string> }
      if (!job || job.status === 'FAILED') {
        await writeRun(draftId, (r) => {
          r.log.push({ stage: r.status, at: new Date().toISOString(), note: `verify_job_${job ? 'failed' : 'missing'}:${(job?.error ?? '').slice(0, 100)}` })
          return r
        })
      }
      const roundResults = (payload.results ?? []).filter(Boolean) as T2vShotResult[]
      // Photo-round results only add reviewed stills; the no-repeat pass decides where they go.
      const history =
        run.photoRound === 1 || run.rescueRound === 1 || run.aiRound === 2
          ? mergeVerifyResults(run.verifyHistory ?? {}, roundResults.map((r) => ({ ...r, chosen: null })))
          : mergeVerifyResults(run.verifyHistory ?? {}, roundResults)
      const round = run.verifyRound ?? 0
      const unresolved = run.shots!.filter((sh) => history[sh.sceneId]?.chosen?.verdict !== 'accepted')
      if (!run.photoRound && unresolved.length && round < MAX_EXTRA_VERIFY_ROUNDS) {
        const next = await nextSearchRound(row, run, unresolved, history, round + 1).catch((err) => {
          logT2vError('pipeline', 'search round failed', err, { draftId, round: round + 1 })
          return null
        })
        if (next) {
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.verifyJobId = next.jobId
            r.verifyRound = round + 1
            r.queriesTried = next.tried
            r.candidates = next.candidates
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `search_round_${round + 1}:${next.shots}_shots` })
            return r
          })
          return
        }
      }
      // Photo fallback: after the video rounds, lines without a usable video clip get Pixabay photos
      // (same visual check, subject rule) before re-checked spares and related fallbacks.
      if (!run.photoRound) {
        const weak = run.shots!.filter((sh) => {
          const c = history[sh.sceneId]?.chosen
          return !c || (c.verdict !== 'accepted' && c.verdict !== 'weak_match')
        })
        const photo = weak.length
          ? await photoSearchRound(row, run, weak, history).catch((err) => {
              logT2vError('pipeline', 'photo round failed', err, { draftId })
              return null
            })
          : null
        if (photo) {
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.verifyJobId = photo.jobId
            r.photoRound = 1
            r.candidates = photo.candidates
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `photo_round:${photo.shots}_shots` })
            return r
          })
          return
        }
      }
      // Related rescue: lines with nothing usable for them get one more search on the closest related
      // subjects (video + photo, same visual check) so they are filled with real footage, never a card.
      if (!run.rescueRound) {
        const dry = enforceNoRepeatDeterministic(run.shots!, history, { realistic: t2vRealisticStyle(run.style), monoOk: t2vMonoRequested(run.prompt) })
        const missing = run.shots!.filter((sh) => !dry.tiers[sh.sceneId] || dry.tiers[sh.sceneId] === 'last_resort')
        const rescue = missing.length
          ? await relatedSearchRound(row, run, missing, history).catch((err) => {
              logT2vError('pipeline', 'related round failed', err, { draftId })
              return null
            })
          : null
        if (rescue) {
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.verifyJobId = rescue.jobId
            r.rescueRound = 1
            r.queriesTried = rescue.tried
            r.candidates = rescue.candidates
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `related_round:${rescue.shots}_shots` })
            return r
          })
          return
        }
      }
      // AI B-roll test (flag/per-run opt-in only): lines where stock is way off after every stock round.
      if (aiBrollEnabled(run) && run.aiRound === 0.5) {
        // Another tick claimed the AI step and is starting the generations: wait (3 min safety valve).
        if (Date.now() - Date.parse(run.aiClaimAt ?? '') < 3 * 60_000) return
      }
      if (aiBrollEnabled(run) && !run.aiRound && (await claimAiStep(draftId))) {
        const started = await aiBrollStart(run, history).catch((err) => {
          logT2vError('pipeline', 'ai broll start failed', err, { draftId })
          return null
        })
        if (started?.jobs.length) {
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.aiRound = 1
            r.aiJobs = started.jobs
            // AI runs after every stock round; never go back to them afterwards.
            r.photoRound ??= 2
            r.rescueRound ??= 2
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `ai_broll_start:${started.jobs.map((j) => j.sceneId).join(',')}` })
            return r
          })
          return
        }
      }
      const noRepeat = await enforceNoRepeat(run.shots!, history, { realistic: t2vRealisticStyle(run.style), monoOk: t2vMonoRequested(run.prompt) })
      const results = run.shots!.map((sh): T2vShotResult => {
        const r = noRepeat.results[sh.sceneId] ?? { sceneId: sh.sceneId, chosen: null, evaluated: [] }
        return { ...r, pickedBy: noRepeat.tiers[sh.sceneId] }
      })
      const fin = await t2vFinisher({
        workspaceId: row.workspaceId,
        doc,
        run,
        story: run.story!,
        segments: run.segments!,
        shots: run.shots!,
        results,
        candidates: run.candidates ?? {},
        banned: noRepeat.banned,
      })
      const qa = t2vQaPlan({ run, scenes: fin.scenes, results: fin.results })
      const stockStats = computeStockStats(fin.results, round)
      const fresh = (await loadRow(draftId))!
      const nextDoc: T2vDraftV1 = {
        ...fresh.document,
        scenes: fin.scenes,
        nextSlot: fin.scenes.length,
        autobuild: moveTo(
          {
            ...fresh.document.autobuild!,
            results: fin.results,
            verifyHistory: undefined,
            verifySummary: payload.summary,
            stockStats,
            qa: [...(fresh.document.autobuild!.qa ?? []), qa],
          },
          'verifying_footage',
          'generating_narration',
        ),
      }
      await saveT2vDraft(row.workspaceId, draftId, fresh.revision, nextDoc)
      await prisma.t2vDraft.update({ where: { id: draftId }, data: { stage: 'pipeline:generating_narration' } })
      logT2v('pipeline', 'edit built', { draftId, scenes: fin.scenes.length, qaPass: qa.pass, ...stockStats })
      logT2v('pipeline', 'stock success rate', { draftId, verifiedRate: stockStats.verifiedRate, stockCoverage: stockStats.stockCoverage, rounds: stockStats.rounds })
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
      const asmJob = run.assembleJobId ? await prisma.clipJob.findUnique({ where: { id: run.assembleJobId }, select: { payload: true } }) : null
      const asmPayload = (asmJob?.payload ?? {}) as { shotStartsMs?: number[]; assembledMs?: number }
      const qa = t2vQaRender({
        run,
        shotLengthsMs: shotLengthsFrom(asmPayload.shotStartsMs, asmPayload.assembledMs),
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

async function enqueueVerify(
  row: Row,
  topic: string,
  shots: NonNullable<T2vPipelineRun['shots']>,
  candidates: Record<string, T2vFootageCandidate[]>,
  opts: { realistic: boolean; monoOk?: boolean; used?: Array<{ providerId: string; phash?: string[] }> },
): Promise<string> {
  const jobId = createId('job')
  await getPrisma().clipJob.create({
    data: {
      id: jobId,
      projectId: row.projectId,
      type: 'T2V_VERIFY_STOCK',
      status: 'QUEUED',
      maxAttempts: 1,
      payload: {
        draftId: row.id,
        workspaceId: row.workspaceId,
        projectId: row.projectId,
        topic,
        realistic: opts.realistic,
        monoOk: opts.monoOk ?? false,
        used: opts.used ?? [],
        shots: shots.map((s) => ({
          sceneId: s.sceneId,
          narration: s.narration,
          intent: s.intent,
          needS: s.needS,
          nightOk: t2vNightLine(s.narration, s.intent),
          subject: s.subject ?? '',
          candidates: (candidates[s.sceneId] ?? []).map((c) => ({
            provider: c.provider,
            providerId: c.providerId,
            previewUrl: c.previewUrl,
            durationS: c.durationS,
            query: c.query,
            author: c.author,
            kind: c.kind ?? 'video',
          })),
        })),
      } as Prisma.InputJsonValue,
    },
  })
  return jobId
}

function pickScore(r: T2vShotResult | undefined): number {
  const c = r?.chosen
  if (!c) return -1
  return (c.verdict === 'accepted' ? 100 : c.verdict === 'weak_match' ? 50 : 0) + (c.score ?? 0)
}

/** Keep the best pick per scene across rounds; accumulate everything the reviewer saw. */
export function mergeVerifyResults(prev: Record<string, T2vShotResult>, round: T2vShotResult[]): Record<string, T2vShotResult> {
  const out: Record<string, T2vShotResult> = { ...prev }
  for (const r of round) {
    const old = out[r.sceneId]
    const evaluated = [...(old?.evaluated ?? []), ...(r.evaluated ?? [])]
    const best = pickScore(r) > pickScore(old) ? r.chosen : old?.chosen ?? null
    out[r.sceneId] = { sceneId: r.sceneId, chosen: best, evaluated }
  }
  return out
}

/** New adjacent queries for unresolved shots → fresh candidates (never re-reviewing a clip) → verify job. */
async function nextSearchRound(
  row: Row,
  run: T2vPipelineRun,
  unresolved: NonNullable<T2vPipelineRun['shots']>,
  history: Record<string, T2vShotResult>,
  round: number,
): Promise<{ jobId: string; tried: Record<string, string[]>; candidates: Record<string, T2vFootageCandidate[]>; shots: number } | null> {
  const tried = { ...(run.queriesTried ?? {}) }
  const alt = await t2vQueryRewriter({ story: run.story!, round, shots: unresolved, tried, history })
  const shots = unresolved.filter((s) => alt[s.sceneId]?.length).map((s) => ({ ...s, queries: alt[s.sceneId]! }))
  if (!shots.length) return null
  const exclude: Record<string, string[]> = {}
  for (const s of shots) exclude[s.sceneId] = (history[s.sceneId]?.evaluated ?? []).map((e) => e.providerId)
  const realistic = t2vRealisticStyle(run.style)
  const found = await t2vFootageAgent({ shots, aspect: row.document.settings.aspect, rewrite: false, exclude, realistic })
  const withCands = shots.filter((s) => found[s.sceneId]?.length)
  for (const s of shots) tried[s.sceneId] = [...(tried[s.sceneId] ?? []), ...s.queries]
  if (!withCands.length) return null
  // Candidates map keeps every round's clips so the finisher can ingest whichever pick wins.
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const used = Object.values(history)
    .map((h) => h.chosen)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => c.verdict === 'accepted')
    .map((c) => ({ providerId: c.providerId, phash: c.phash }))
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic, monoOk: t2vMonoRequested(run.prompt), used })
  return { jobId, tried, candidates, shots: withCands.length }
}

/** Atomic claim so two concurrent ticks can never both start paid generations. */
async function claimAiStep(draftId: string): Promise<boolean> {
  const n = await getPrisma().$executeRaw`
    UPDATE t2v_drafts
    SET document = jsonb_set(jsonb_set(document::jsonb, '{autobuild,aiRound}', '0.5'::jsonb), '{autobuild,aiClaimAt}', to_jsonb(${new Date().toISOString()}::text))
    WHERE id = ${draftId} AND NOT ((document::jsonb -> 'autobuild') ? 'aiRound')`
  return n === 1
}

/** Start one generation per target scene (aiBrollTargets: weakest first, max 3); no retries. */
async function aiBrollStart(run: T2vPipelineRun, history: Record<string, T2vShotResult>): Promise<{ jobs: T2vAiJob[] }> {
  const opts = { realistic: t2vRealisticStyle(run.style), monoOk: t2vMonoRequested(run.prompt) }
  // Predict with the same full pass the edit uses (spares + sequence check), so the clips go where the
  // final picks would really be weakest (the dry pass misses look-alike swaps).
  const full = await enforceNoRepeat(run.shots!, history, opts).catch(() => undefined)
  const predicted = full ? { out: full.results, tiers: full.tiers } : undefined
  const needy = aiBrollTargets(run.shots!, history, opts, predicted)
  if (!needy.length) return { jobs: [] }
  const prompts = await aiBrollPrompts(run.story?.topic || run.story?.title || '', needy)
  const jobs: T2vAiJob[] = []
  for (const sh of needy) {
    const numFrames = aiFramesFor(sh.needS)
    try {
      const predictionId = await startAiClip(prompts[sh.sceneId]!, numFrames)
      jobs.push({ sceneId: sh.sceneId, predictionId, numFrames, fps: 24, prompt: prompts[sh.sceneId]!, createdAt: new Date().toISOString() })
    } catch (err) {
      logT2v('pipeline-ai', 'generation not started', { sceneId: sh.sceneId, error: err instanceof Error ? err.message : 'error' })
    }
  }
  return { jobs }
}

/** Poll the generations; when all settle (or 8 min pass), enqueue one verify job for the finished clips. */
async function aiBrollPoll(
  row: Row,
  run: T2vPipelineRun,
): Promise<{ done: boolean; jobs: T2vAiJob[]; costUsd: number; ok: number; jobId?: string; candidates?: Record<string, T2vFootageCandidate[]> }> {
  const jobs = [...(run.aiJobs ?? [])]
  const urls: Record<string, string> = {}
  for (const j of jobs) {
    if (j.status === 'succeeded' || j.status === 'failed' || j.status === 'canceled') continue
    const p = await pollAiClip(j.predictionId).catch(() => ({ status: 'unknown' as string, outputUrl: undefined, predictTimeS: undefined, error: 'poll_failed' }))
    j.status = p.status
    if (p.predictTimeS !== undefined) j.predictTimeS = p.predictTimeS
    if (p.error) j.error = p.error
    if (p.status === 'succeeded' && p.outputUrl) urls[j.sceneId] = p.outputUrl
    if (p.status === 'succeeded' || p.status === 'failed') {
      j.estCostUsd = p.status === 'succeeded' ? AI_BROLL_EST_USD_PER_CLIP : 0
      logT2v('pipeline-ai', 'clip settled', { sceneId: j.sceneId, status: p.status, numFrames: j.numFrames, predictTimeS: p.predictTimeS, estCostUsd: j.estCostUsd })
    }
  }
  const costUsd = Math.round(jobs.reduce((n, j) => n + (j.estCostUsd ?? 0), 0) * 1000) / 1000
  const oldest = Math.min(...jobs.map((j) => Date.parse(j.createdAt)))
  const pending = jobs.filter((j) => j.status !== 'succeeded' && j.status !== 'failed' && j.status !== 'canceled')
  if (pending.length && Date.now() - oldest < 8 * 60_000) return { done: false, jobs, costUsd, ok: 0 }
  // Succeeded earlier polls lost their URL in this tick: re-read them (cheap GET, not a paid retry).
  for (const j of jobs) {
    if (j.status === 'succeeded' && !urls[j.sceneId]) {
      const p = await pollAiClip(j.predictionId).catch(() => null)
      if (p?.outputUrl) urls[j.sceneId] = p.outputUrl
    }
  }
  logT2v('pipeline-ai', 'run total', { draftId: row.id, clips: jobs.length, succeeded: Object.keys(urls).length, estCostUsd: costUsd })
  const found: Record<string, T2vFootageCandidate[]> = {}
  for (const j of jobs) if (urls[j.sceneId]) found[j.sceneId] = [aiCandidate(j as T2vAiJob, urls[j.sceneId]!)]
  const shots = run.shots!.filter((s) => found[s.sceneId])
  if (!shots.length) return { done: true, jobs, costUsd, ok: 0 }
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of shots) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', shots, found, { realistic: t2vRealisticStyle(run.style), monoOk: t2vMonoRequested(run.prompt) })
  return { done: true, jobs, costUsd, ok: shots.length, jobId, candidates }
}

/** Related rescue round: closest related subjects (rewriter related mode) → videos + photos → one verify job. */
async function relatedSearchRound(
  row: Row,
  run: T2vPipelineRun,
  missing: NonNullable<T2vPipelineRun['shots']>,
  history: Record<string, T2vShotResult>,
): Promise<{ jobId: string; tried: Record<string, string[]>; candidates: Record<string, T2vFootageCandidate[]>; shots: number } | null> {
  const tried = { ...(run.queriesTried ?? {}) }
  const alt = await t2vQueryRewriter({ story: run.story!, round: 4, shots: missing, tried, history, mode: 'related' })
  const shots = missing.filter((s) => alt[s.sceneId]?.length).map((s) => ({ ...s, queries: alt[s.sceneId]! }))
  if (!shots.length) return null
  for (const s of shots) tried[s.sceneId] = [...(tried[s.sceneId] ?? []), ...s.queries]
  const realistic = t2vRealisticStyle(run.style)
  const reviewed = Object.values(history).flatMap((h) => h.evaluated.map((e) => e.providerId))
  const exclude: Record<string, string[]> = {}
  for (const s of shots) exclude[s.sceneId] = reviewed
  const aspect = row.document.settings.aspect
  const videos = await t2vFootageAgent({ shots, aspect, rewrite: false, exclude, realistic })
  const photos = await t2vPhotoAgent({ shots, aspect, realistic, exclude: new Set(reviewed) })
  const found: Record<string, T2vFootageCandidate[]> = {}
  for (const s of shots) {
    const list = [...(videos[s.sceneId] ?? []).slice(0, 4), ...(photos[s.sceneId] ?? []).slice(0, 3)]
    if (list.length) found[s.sceneId] = list
  }
  const withCands = shots.filter((s) => found[s.sceneId]?.length)
  if (!withCands.length) return null
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic, monoOk: t2vMonoRequested(run.prompt) })
  return { jobId, tried, candidates, shots: withCands.length }
}

/** Photo fallback round: Pixabay photos for weak lines → one verify job (stills, same checks). */
async function photoSearchRound(
  row: Row,
  run: T2vPipelineRun,
  weak: NonNullable<T2vPipelineRun['shots']>,
  history: Record<string, T2vShotResult>,
): Promise<{ jobId: string; candidates: Record<string, T2vFootageCandidate[]>; shots: number } | null> {
  const realistic = t2vRealisticStyle(run.style)
  const exclude = new Set(Object.values(history).flatMap((h) => h.evaluated.map((e) => e.providerId)))
  const found = await t2vPhotoAgent({ shots: weak, aspect: row.document.settings.aspect, realistic, exclude })
  const withCands = weak.filter((s) => found[s.sceneId]?.length)
  if (!withCands.length) return null
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic, monoOk: t2vMonoRequested(run.prompt) })
  return { jobId, candidates, shots: withCands.length }
}

/** Shot lengths from the assembler's shot starts; the closing end card (last entry) is excluded. */
export function shotLengthsFrom(starts: number[] | undefined, totalMs: number | undefined): number[] | undefined {
  if (!starts?.length || !totalMs) return undefined
  const sorted = [...starts].sort((a, b) => a - b)
  const lens = sorted.map((s, i) => (sorted[i + 1] ?? totalMs) - s)
  return lens.slice(0, -1).filter((l) => l > 0)
}

function computeStockStats(results: T2vShotResult[], round: number): NonNullable<T2vPipelineRun['stockStats']> {
  const n = results.length || 1
  const count = (f: (r: T2vShotResult) => boolean) => results.filter(f).length
  const accepted = count((r) => r.outcome === 'stock' && r.chosen?.verdict === 'accepted')
  const weak = count((r) => r.outcome === 'stock' && r.chosen?.verdict === 'weak_match')
  const bestAvailable = count((r) => r.outcome === 'stock' && r.chosen?.verdict === 'best_available')
  const held = count((r) => r.outcome === 'held')
  const titleCards = count((r) => r.outcome === 'title_card')
  return {
    shots: results.length,
    accepted,
    weak,
    bestAvailable,
    held,
    titleCards,
    verifiedRate: Math.round((accepted / n) * 1000) / 10,
    // Lines with their own reviewed clip (any verdict), i.e. not held on the previous shot or a card.
    ownClipRate: Math.round(((accepted + weak + bestAvailable) / n) * 1000) / 10,
    pickedBy: results.reduce<Partial<Record<T2vPickedBy, number>>>((acc, r) => {
      if (r.pickedBy) acc[r.pickedBy] = (acc[r.pickedBy] ?? 0) + 1
      return acc
    }, {}),
    stockCoverage: Math.round(((n - titleCards) / n) * 1000) / 10,
    rounds: round + 1,
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
