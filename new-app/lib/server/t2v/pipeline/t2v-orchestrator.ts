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
import type { T2vLookalikeBan } from '@/lib/t2v/pipeline/t2v-types'
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
  type T2vPlannedShot,
  type T2vReimagineLogEntry,
  type T2vReimaginePending,
} from '@/lib/t2v/pipeline/t2v-types'
import { t2vScriptAgent, t2vStoryAgent } from '@/lib/server/t2v/pipeline/t2v-story-agent'
import { t2vScenePlanner } from '@/lib/server/t2v/pipeline/t2v-scene-planner'
import { queryRewrites, t2vFootageAgent, t2vPhotoAgent } from '@/lib/server/t2v/pipeline/t2v-footage-agent'
import { t2vQueryRewriter } from '@/lib/server/t2v/pipeline/t2v-query-rewriter'
import { depictsRank, enforceNoRepeat, t2vQualityOk } from '@/lib/server/t2v/pipeline/t2v-no-repeat'
import { fixLineShows, t2vLineShowsOnce, t2vScriptContext } from '@/lib/server/t2v/pipeline/t2v-script-context'
import { baseSceneId, compactScript, ideaShots, logReimagineOutcomes, reimagineBudget, reimagineFailing, reimagineOutcomes, reimagineTargets, sceneAllowance, sceneContext, T2V_REIMAGINE_ROUNDS, t2vReimagineAll, trimPerScene } from '@/lib/server/t2v/pipeline/t2v-reimagine'
import { t2vFinisher } from '@/lib/server/t2v/pipeline/t2v-finisher'
import { t2vQaPlan, t2vQaRender } from '@/lib/server/t2v/pipeline/t2v-qa'
import {
  AI_BROLL_EST_USD_PER_CLIP,
  AI_START_SPACING_MS,
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
const MAX_EXTRA_VERIFY_ROUNDS = 2

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
      const planned = await t2vScenePlanner({ story: run.story!, segments: run.segments!, style: run.style, seed: `${draftId}:${run.startedAt}` })
      // One LLM pass over the whole paced script: the video in the model's own words, plus each shot's moment.
      const context = await t2vScriptContext(run.story!, planned)
      // Every line leaves planning with ONE fixed lineShows (the checker never writes its own per clip).
      const shots = fixLineShows(context.shots).shots
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
        if (context.videoUnderstanding && r.story) r.story.videoUnderstanding = context.videoUnderstanding
      })
      logT2v('pipeline', 'scenes planned', { draftId, shots: shots.length })
      return advanceOnce(draftId, {})
    }
    case 'finding_footage': {
      // A plan frozen before the script-context pass (restart at finding_footage): add the moments once.
      if (run.shots?.length && !run.story?.videoUnderstanding && !run.shots.some((s) => s.moment)) {
        const context = await t2vScriptContext(run.story!, run.shots)
        if (context.videoUnderstanding) {
          await writeRun(draftId, (r) => {
            r.shots = context.shots
            if (r.story) r.story.videoUnderstanding = context.videoUnderstanding
            return r
          })
          return advanceOnce(draftId, {})
        }
      }
      // Frozen plan without lineShows: write them ONCE (persisted on the run's shots, never regenerated in this
      // run), with each line's literal searches first, so the search and every check use the same fixed text.
      if (run.shots?.length && !run.lineShowsFixedAt && run.shots.some((s) => !s.lineShows?.trim())) {
        const fixed = await t2vLineShowsOnce(run.story!, run.shots)
        await writeRun(draftId, (r) => {
          r.shots = fixed.shots
          r.lineShowsFixedAt = new Date().toISOString()
          r.log.push({ stage: r.status, at: r.lineShowsFixedAt, note: `line_shows_fixed:${fixed.fromModel}_model:${fixed.fallback.length}_intent` })
          return r
        })
        return advanceOnce(draftId, {})
      }
      const topic = run.story?.topic || run.story?.title || ''
      const realistic = t2vRealisticStyle(run.style)
      const found = await t2vFootageAgent({ shots: run.shots!, aspect: doc.settings.aspect, topic, realistic })
      // Incumbents (reset --from-footage): the previous run's placed pick is re-verified first under the fixed
      // lineShows; the pick pass keeps it unless a new clip is clearly better.
      const all = withIncumbents(found, run)
      const capped = fairTrim(run.shots!.map((s) => s.sceneId), all, T2V_RUN_VERIFY_BUDGET)
      if (capped.dropped) logT2v('pipeline', 'run verify budget hit', { draftId, stage: 'search_0', budget: T2V_RUN_VERIFY_BUDGET, used: 0, sent: capped.used, dropped: capped.dropped })
      const candidates = capped.found
      const jobId = await enqueueVerify(row, topic, run.shots!, candidates, { realistic })
      const tried: Record<string, string[]> = {}
      for (const sh of run.shots!) tried[sh.sceneId] = queryRewrites(sh.queries, topic)
      await setStage(draftId, 'finding_footage', 'verifying_footage', (r) => {
        r.candidates = candidates
        r.verifyJobId = jobId
        r.verifyRound = 0
        r.queriesTried = tried
        if (capped.dropped) r.verifyBudgetHit = [...(r.verifyBudgetHit ?? []), { stage: 'search_0', at: new Date().toISOString(), dropped: capped.dropped }]
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
      // No job id at all is expected after a reimagine step that found no clips to check (not a lost job).
      if ((!job && run.verifyJobId) || job?.status === 'FAILED') {
        await writeRun(draftId, (r) => {
          r.log.push({ stage: r.status, at: new Date().toISOString(), note: `verify_job_${job ? 'failed' : 'missing'}:${(job?.error ?? '').slice(0, 100)}` })
          return r
        })
      }
      // Verifier calls per run (one Gemini watch per candidate): counted once per job, logged per job and at the end.
      let verifierCalls = run.verifierCalls ?? 0
      if (job?.status === 'DONE' && !(run.verifierJobs ?? []).includes(job.id)) {
        const calls = Number(payload.summary?.geminiCalls ?? 0) || 0
        const stage = run.aiRound === 2 ? 'ai' : (run.reimagineRound ?? 0) > 0 ? 'reimagine' : run.photoRound === 1 ? 'photo' : run.rescueRound === 1 ? 'rescue' : `search_${run.verifyRound ?? 0}`
        verifierCalls += calls
        logT2v('pipeline', 'verifier calls', { draftId, jobId: job.id, stage, calls, runTotal: verifierCalls })
        await writeRun(draftId, (r) => {
          if ((r.verifierJobs ?? []).includes(job.id)) return r
          r.verifierCalls = (r.verifierCalls ?? 0) + calls
          r.verifierJobs = [...(r.verifierJobs ?? []), job.id]
          return r
        })
      }
      // Reimagined ideas verify under `${sceneId}~iK`; their results belong to the line itself.
      const roundResults = markIncumbents(
        ((payload.results ?? []).filter(Boolean) as T2vShotResult[]).map((r) => ({ ...r, sceneId: baseSceneId(r.sceneId) })),
        run.priorPicks,
      )
      // Per line, per round: ideas, queries, every candidate's score and whether the line now passes (5+).
      if (run.reimaginePending) {
        const entries = reimagineOutcomes(run.reimaginePending, (payload.results ?? []) as T2vShotResult[])
        logReimagineOutcomes(draftId, entries)
        await writeRun(draftId, (r) => {
          r.reimagineLog = [...(r.reimagineLog ?? []), ...entries]
          r.reimaginePending = undefined
          return r
        })
      }
      // Photo, reimagine and AI results only add reviewed options; the no-repeat pass decides where they go.
      const history =
        run.photoRound === 1 || run.rescueRound === 1 || (run.reimagineRound ?? 0) > 0 || run.aiRound === 2
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
      // Reimagine, PER LINE: every line where no candidate reaches FILLER_MIN_SCORE (5/10) gets NEW shot ideas
      // for the same moment (whole script, the moment, what was tried and why it failed), searched and verified
      // like any shot. Each line gets at most T2V_REIMAGINE_ROUNDS rounds of its own; there is no cap on how many
      // lines take part. Only lines that still fail after their rounds fall through to AI / extend-previous.
      // Availability is judged by the SAME full pick pass the edit uses (spare re-check + look-alike sequence
      // check): a line whose 9-10 clips are all used by other lines or banned as look-alikes has no clip and is
      // reimagined too (sleep sc_3 / sc_15). The same pass is reused for the final pick when nothing changes.
      // It also runs after the AI clips are verified, so lines that lost their clip to a later ban still get
      // their own remaining rounds before the finisher extends the previous shot.
      let fullPass: Awaited<ReturnType<typeof enforceNoRepeat>> | undefined
      // Text re-checks made in this tick (spares, cross-line, hold comparisons): counted in verifierCalls (QA S4).
      let rechecksThisTick = 0
      if (!run.rescueRound && (!run.aiRound || run.aiRound === 2)) {
        const tries = run.reimagineTries ?? {}
        fullPass = await enforceNoRepeat(run.shots!, history, pickOpts(run))
        rechecksThisTick += fullPass.rechecks
        const report = reimagineFailing(run.shots!, history, fullPass)
        // A line skipped for budget or no ideas is done with reimagine (honestly logged, not counted as a round).
        const gate = { ...tries }
        for (const id of Object.keys(run.reimagineSkipped ?? {})) gate[id] = T2V_REIMAGINE_ROUNDS
        const targets = reimagineTargets(report.map((f) => f.shot), gate)
        for (const f of report) {
          logT2v('pipeline-reimagine', 'availability', { draftId, sceneId: f.shot.sceneId, ownAt5: f.ownAt5, blocked: f.blocked, rounds: tries[f.shot.sceneId] ?? 0, reimagine: targets.includes(f.shot) })
        }
        if (targets.length) {
          const step = (run.reimagineRound ?? 0) + 1
          const next = await reimagineRound(row, run, targets, history, tries).catch((err) => {
            logT2vError('pipeline', 'reimagine round failed', err, { draftId, step, scenes: targets.length })
            return null
          })
          // Lines whose round found nothing to check are logged now; the rest when the verify job ends.
          const settled = next ? next.settledNow : []
          if (settled.length) logReimagineOutcomes(draftId, settled)
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.reimagineRound = step
            const t = { ...(r.reimagineTries ?? {}) }
            // A thrown round (search/LLM error) ends reimagine for its lines: no paid automatic retries.
            // Only rounds that really happened count; a thrown round (search/LLM error) ends reimagine for its
            // lines (no paid automatic retries); skipped lines are recorded with their reason.
            if (!next) for (const s of targets) t[s.sceneId] = T2V_REIMAGINE_ROUNDS
            else for (const id of next.counted) t[id] = (tries[id] ?? 0) + 1
            r.reimagineTries = t
            if (next && Object.keys(next.skipped).length) r.reimagineSkipped = { ...(r.reimagineSkipped ?? {}), ...next.skipped }
            if (next) {
              r.reimagineScenes = next.reimagineScenes
              r.reimagineBudget = next.budget
            }
            // Look-alike bans of this pass are kept on the run: the next pass (after the reimagine verify) is a
            // fresh model call that may not flag the same pair again (snow 44082 came back on sc_19).
            r.lookalikeBans = mergeBans(r.lookalikeBans, fullPass!.lookalikeBans)
            addRechecks(r, rechecksThisTick)
            if (next) r.reimagineVerifyUsed = (r.reimagineVerifyUsed ?? 0) + next.verifyUsed
            r.verifyJobId = next?.jobId ?? undefined
            r.reimaginePending = next?.jobId ? next.pending : undefined
            if (settled.length) r.reimagineLog = [...(r.reimagineLog ?? []), ...settled]
            if (next) {
              r.queriesTried = next.tried
              r.candidates = next.candidates
            }
            const rounds = targets.map((s) => t[s.sceneId] ?? 0).join(',')
            const skippedNote = next && Object.keys(next.skipped).length ? `:skipped=${Object.entries(next.skipped).map(([k, v]) => `${k}:${v}`).join(',')}` : ''
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: next ? `reimagine_step_${step}:${targets.length}_lines:${next.shots}_with_clips:${next.ideas}_ideas:rounds=${rounds}${skippedNote}:budget=${next.budget}` : `reimagine_step_${step}:failed:${targets.length}_lines` })
            return r
          })
          if (next?.jobId) return
          // Nothing to verify this step: go straight to the next per-line round (or fall through).
          return advanceOnce(draftId, {})
        }
      }
      // AI B-roll test (flag/per-run opt-in only): lines where stock is way off after every stock round.
      if (aiBrollEnabled(run) && run.aiRound === 0.5) {
        // Another tick claimed the AI step and is starting the generations: wait (3 min safety valve).
        if (Date.now() - Date.parse(run.aiClaimAt ?? '') < 3 * 60_000) return
      }
      if (aiBrollEnabled(run) && !run.aiRound && (await claimAiStep(draftId))) {
        // Seed the AI step with this tick's bans too (QA F1: it started from the stale run list and overwrote it).
        const started = await aiBrollStart({ ...run, lookalikeBans: mergeBans(run.lookalikeBans, fullPass?.lookalikeBans) }, history).catch((err) => {
          logT2vError('pipeline', 'ai broll start failed', err, { draftId })
          return null
        })
        if (started?.jobs.length) {
          await writeRun(draftId, (r) => {
            r.verifyHistory = history
            r.aiRound = 1
            r.aiJobs = started.jobs
            r.lookalikeBans = mergeBans(r.lookalikeBans, fullPass?.lookalikeBans, started.lookalikeBans)
            addRechecks(r, rechecksThisTick + (started.rechecks ?? 0))
            // AI runs after every stock round; never go back to them afterwards.
            r.photoRound ??= 2
            r.log.push({ stage: r.status, at: new Date().toISOString(), note: `ai_broll_start:${started.jobs.map((j) => j.sceneId).join(',')}` })
            return r
          })
          return
        }
      }
      // Same pass the availability check used (no second sequence check that could ban differently).
      const noRepeat = fullPass ?? (await enforceNoRepeat(run.shots!, history, pickOpts(run)))
      if (!fullPass) rechecksThisTick += noRepeat.rechecks
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
        lookalikeBans: noRepeat.lookalikeBans,
      })
      rechecksThisTick += fin.rechecks
      verifierCalls += rechecksThisTick
      logScenePicks(draftId, run.shots!, fin.results)
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
            lookalikeBans: mergeBans(fresh.document.autobuild!.lookalikeBans, fin.lookalikeBans),
            verifierCalls: (fresh.document.autobuild!.verifierCalls ?? 0) + rechecksThisTick,
            recheckCalls: (fresh.document.autobuild!.recheckCalls ?? 0) + rechecksThisTick,
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
      logT2v('pipeline', 'edit built', { draftId, scenes: fin.scenes.length, qaPass: qa.pass, verifierCalls, ...stockStats })
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
        shotLengthsMs: shotLengthsFrom(asmPayload.shotStartsMs, asmPayload.assembledMs, Boolean(row.document.scenes?.at(-1)?.id.startsWith('sc_end'))),
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
  opts: { realistic: boolean; used?: Array<{ providerId: string; phash?: string[] }> },
): Promise<string> {
  const jobId = createId('job')
  // The checker reads the whole script, the neighbouring lines and this line's moment (story order).
  const run = row.document.autobuild
  const all = run?.shots?.length ? run.shots : shots
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
        used: opts.used ?? [],
        script: compactScript(all),
        videoUnderstanding: run?.story?.videoUnderstanding ?? '',
        shots: shots.map((s) => {
          // Full sentence (split scenes) + neighbouring lines: the checker never reads a fragment alone.
          const ctx = sceneContext(all, s.sceneId)
          return {
            sceneId: s.sceneId,
            narration: s.narration,
            intent: s.intent,
            needS: s.needS,
            subject: s.subject ?? '',
            moment: s.moment ?? '',
            lineNo: ctx.lineNo,
            sentence: ctx.sentence,
            prevNarration: ctx.prevNarration,
            nextNarration: ctx.nextNarration,
            // Reimagine: the shot idea that found these clips (the checker requires the clip to show it too).
            idea: s.idea ?? '',
            // The line's FIXED lineShows: every clip of this line (every round, reimagine ideas too) is judged
            // against this same text; the checker does not write its own.
            lineShows: fixedLineShows(all, s),
            candidates: (candidates[s.sceneId] ?? []).map((c) => ({
              provider: c.provider,
              providerId: c.providerId,
              previewUrl: c.previewUrl,
              durationS: c.durationS,
              query: c.query,
              author: c.author,
              kind: c.kind ?? 'video',
            })),
          }
        }),
      } as Prisma.InputJsonValue,
    },
  })
  return jobId
}

/**
 * Run-level verifier cap for the STOCK stage (first pass, extra search rounds, photo round): QA F3 (319 / 443
 * checks). Reimagine rework has its own per-scene budget (reimagineBudget) and is not cut by this cap, so John's
 * rework rounds for scenes under 5 are never silently skipped. When the cap is hit the leftover lines fall
 * through to photo / reimagine / the finisher, and the skip is logged and stored on the run.
 */
export const T2V_RUN_VERIFY_BUDGET = (() => {
  const v = Number.parseInt(process.env.T2V_RUN_VERIFY_BUDGET ?? '', 10)
  return Number.isFinite(v) && v > 0 ? Math.min(v, 2000) : 250
})()

/** Stock-stage checks so far: verifier calls minus re-checks and reimagine checks. */
export function stockVerifyUsed(run: Pick<T2vPipelineRun, 'verifierCalls' | 'recheckCalls' | 'reimagineVerifyUsed'>): number {
  return Math.max(0, (run.verifierCalls ?? 0) - (run.recheckCalls ?? 0) - (run.reimagineVerifyUsed ?? 0))
}

/** Trim candidates to `left`, one per scene at a time (story order within each turn), so no scene starves. */
export function fairTrim<C>(order: string[], found: Record<string, C[]>, left: number): { found: Record<string, C[]>; used: number; dropped: number } {
  const out: Record<string, C[]> = {}
  let used = 0
  const total = order.reduce((n, id) => n + (found[id]?.length ?? 0), 0)
  for (let k = 0; used < left && order.some((id) => (found[id]?.length ?? 0) > k); k++) {
    for (const id of order) {
      const c = found[id]?.[k]
      if (c === undefined || used >= left) continue
      ;(out[id] ??= []).push(c)
      used++
    }
  }
  return { found: out, used, dropped: total - used }
}

/** Union of ban lists (first occurrence of a providerId wins): no pass ever drops a ban another pass found. */
export function mergeBans(...lists: Array<T2vLookalikeBan[] | undefined>): T2vLookalikeBan[] {
  const out: T2vLookalikeBan[] = []
  for (const l of lists) for (const b of l ?? []) if (!out.some((x) => x.providerId === b.providerId)) out.push(b)
  return out
}

/** Add text re-checks to the run's verifier count (and the re-check count), logged. */
function addRechecks(r: T2vPipelineRun, n: number) {
  if (!n) return
  r.verifierCalls = (r.verifierCalls ?? 0) + n
  r.recheckCalls = (r.recheckCalls ?? 0) + n
}

/** Prepend each line's prior pick (if any, and not already listed) so the first verify job re-checks it. */
export function withIncumbents(found: Record<string, T2vFootageCandidate[]>, run: Pick<T2vPipelineRun, 'priorPicks' | 'shots'>): Record<string, T2vFootageCandidate[]> {
  const out = { ...found }
  for (const s of run.shots ?? []) {
    const p = run.priorPicks?.[s.sceneId]
    if (!p?.candidate) continue
    const list = (out[s.sceneId] ?? []).filter((c) => c.providerId !== p.providerId)
    out[s.sceneId] = [p.candidate, ...list]
  }
  return out
}

/** Flag each line's re-verified prior pick as the incumbent (the pick pass keeps it unless clearly beaten). */
export function markIncumbents(results: T2vShotResult[], prior: T2vPipelineRun['priorPicks']): T2vShotResult[] {
  if (!prior) return results
  return results.map((r) => {
    const id = prior[r.sceneId]?.providerId
    if (!id) return r
    const mark = <T extends { providerId: string }>(e: T) => (e.providerId === id ? { ...e, incumbent: true } : e)
    return { ...r, evaluated: (r.evaluated ?? []).map(mark), chosen: r.chosen ? mark(r.chosen) : r.chosen }
  })
}

/** The line's fixed lineShows (idea shots `sc~iK` use their line's); the planner intent only as a last resort. */
export function fixedLineShows(all: T2vPlannedShot[], s: T2vPlannedShot): string {
  const base = all.find((x) => x.sceneId === baseSceneId(s.sceneId))
  return (base?.lineShows || s.lineShows || base?.intent || s.intent || '').trim()
}

/** Options for every pick pass (dry run, no-repeat, AI targets): style plus the script for the re-checks. */
function pickOpts(run: T2vPipelineRun) {
  return {
    realistic: t2vRealisticStyle(run.style),
    script: compactScript(run.shots ?? []),
    videoUnderstanding: run.story?.videoUnderstanding,
    // Every pass starts from the run's look-alike bans (pick passes, AI step, finisher).
    lookalikeBans: run.lookalikeBans ?? [],
  }
}

/** Per-scene pick log (no URLs): line, tier, clip, score and the reviewer's own words. */
function logScenePicks(draftId: string, shots: T2vPlannedShot[], results: T2vShotResult[]) {
  const by = new Map(results.map((r) => [r.sceneId, r]))
  shots.forEach((s, i) => {
    const r = by.get(s.sceneId)
    logT2v('pipeline-pick', 'scene', {
      draftId,
      sceneIndex: i,
      sceneId: s.sceneId,
      pickedBy: r?.pickedBy ?? null,
      providerId: r?.chosen?.providerId ?? null,
      score: r?.chosen?.score ?? null,
      fitReason: r?.chosen?.fitReason ?? '',
      fitReasonFrom: r?.chosen?.fitReasonFrom ?? (r?.chosen ? 'verify' : null),
      seen: r?.chosen?.seen ?? r?.chosen?.visible ?? '',
      reviewedForOtherLine: r?.chosen?.reviewedForOtherLine ?? null,
      reviewed: r?.evaluated?.length ?? 0,
    })
  })
}

function pickScore(r: T2vShotResult | undefined): number {
  const c = r?.chosen
  if (!c) return -1
  // Depiction before score (same order as the pick pass): yes > not judged > partly > no.
  return (c.verdict === 'accepted' ? 100 : c.verdict === 'weak_match' ? 50 : 0) + 11 * depictsRank(c) + (c.score ?? 0)
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
  for (const s of shots) tried[s.sceneId] = [...(tried[s.sceneId] ?? []), ...s.queries]
  if (!(await capToRunBudget(row.id, run, shots, found, `search_${round}`))) return null
  const withCands = shots.filter((s) => found[s.sceneId]?.length)
  if (!withCands.length) return null
  // Candidates map keeps every round's clips so the finisher can ingest whichever pick wins.
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const used = Object.values(history)
    .map((h) => h.chosen)
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
    .filter((c) => c.verdict === 'accepted')
    .map((c) => ({ providerId: c.providerId, phash: c.phash }))
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic, used })
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
async function aiBrollStart(run: T2vPipelineRun, history: Record<string, T2vShotResult>): Promise<{ jobs: T2vAiJob[]; lookalikeBans?: T2vLookalikeBan[]; rechecks?: number }> {
  const opts = pickOpts(run)
  // Predict with the same full pass the edit uses (spares + sequence check), so the clips go where the
  // final picks would really be weakest (the dry pass misses look-alike swaps).
  const full = await enforceNoRepeat(run.shots!, history, opts).catch(() => undefined)
  const predicted = full ? { out: full.results, tiers: full.tiers } : undefined
  const needy = aiBrollTargets(run.shots!, history, opts, predicted)
  if (!needy.length) return { jobs: [], lookalikeBans: full?.lookalikeBans, rechecks: full?.rechecks }
  const prompts = await aiBrollPrompts(run.story?.topic || run.story?.title || '', needy)
  const jobs: T2vAiJob[] = []
  for (const [k, sh] of needy.entries()) {
    const numFrames = aiFramesFor(sh.needS)
    if (k > 0) await new Promise((r) => setTimeout(r, AI_START_SPACING_MS))
    try {
      const predictionId = await startAiClip(prompts[sh.sceneId]!, numFrames)
      jobs.push({ sceneId: sh.sceneId, predictionId, numFrames, fps: 24, prompt: prompts[sh.sceneId]!, createdAt: new Date().toISOString() })
    } catch (err) {
      logT2v('pipeline-ai', 'generation not started', { sceneId: sh.sceneId, error: err instanceof Error ? err.message : 'error' })
    }
  }
  return { jobs, lookalikeBans: full?.lookalikeBans, rechecks: full?.rechecks }
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
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', shots, found, { realistic: t2vRealisticStyle(run.style) })
  return { done: true, jobs, costUsd, ok: shots.length, jobId, candidates }
}

/**
 * One reimagine step for ALL target lines (each at its own round number): the LLM proposes alternative shot
 * ideas (batched calls, every line included), each idea is searched (video + photo) and verified under
 * `${sceneId}~iK` against the ORIGINAL line, script and moment. Lines with no ideas or no clips found are
 * returned in `settledNow` (round counted); the rest are in `pending` until the verify job ends.
 */
async function reimagineRound(
  row: Row,
  run: T2vPipelineRun,
  targets: NonNullable<T2vPipelineRun['shots']>,
  history: Record<string, T2vShotResult>,
  tries: Record<string, number>,
): Promise<{
  jobId: string | null
  tried: Record<string, string[]>
  candidates: Record<string, T2vFootageCandidate[]>
  shots: number
  ideas: number
  pending: T2vReimaginePending
  settledNow: T2vReimagineLogEntry[]
  verifyUsed: number
  /** Lines whose round really happened (ideas searched; verified when clips were found): their tries count. */
  counted: string[]
  /** Lines whose round did NOT happen, with the honest reason (not counted as a round). */
  skipped: Record<string, 'budget' | 'no_ideas'>
  budget: number
  reimagineScenes: string[]
}> {
  const tried = { ...(run.queriesTried ?? {}) }
  // Budget sized from every scene that has needed rework so far (each is entitled to its rounds).
  const reimagineScenes = [...new Set([...(run.reimagineScenes ?? []), ...targets.map((s) => s.sceneId)])]
  const budget = reimagineBudget(reimagineScenes.length)
  const left = Math.max(0, budget - (run.reimagineVerifyUsed ?? 0))
  const allowance = sceneAllowance(targets.map((s) => s.sceneId), tries, left)
  const skipped: Record<string, 'budget' | 'no_ideas'> = {}
  for (const s of targets) if (!allowance[s.sceneId]) skipped[s.sceneId] = 'budget'
  const asked = targets.filter((s) => !skipped[s.sceneId])
  const roundOf = (sceneId: string) => (tries[sceneId] ?? 0) + 1
  const ideas = asked.length ? await t2vReimagineAll({ story: run.story!, allShots: run.shots!, targets: asked, tried, history }) : {}
  // Zero ideas for a line (sleep sh14 round 2): re-ask ONCE in this step for just those lines; a line still
  // without ideas is skipped honestly (no round, no budget used) instead of burning a round.
  const empty = asked.filter((s) => !ideas[s.sceneId]?.length)
  if (empty.length) {
    logT2v('pipeline-reimagine', 'no ideas, asking once more', { draftId: row.id, lines: empty.map((s) => s.sceneId) })
    const again = await t2vReimagineAll({ story: run.story!, allShots: run.shots!, targets: empty, tried, history }).catch(() => ({}) as Record<string, never>)
    for (const s of empty) {
      if (again[s.sceneId]?.length) ideas[s.sceneId] = again[s.sceneId]!
      else skipped[s.sceneId] = 'no_ideas'
    }
  }
  const plan: T2vReimaginePending = {}
  for (const s of asked) {
    if (skipped[s.sceneId]) continue
    plan[s.sceneId] = { round: roundOf(s.sceneId), ideas: (ideas[s.sceneId] ?? []).map((d) => ({ intent: d.intent, queries: d.queries })) }
    logT2v('pipeline-reimagine', 'ideas', { draftId: row.id, round: roundOf(s.sceneId), sceneId: s.sceneId, ideas: (ideas[s.sceneId] ?? []).map((d) => ({ intent: d.intent, mustRecognise: d.mustRecognise, queries: d.queries })) })
  }
  const shots = asked.flatMap((s) => (!skipped[s.sceneId] && ideas[s.sceneId]?.length ? ideaShots(s, ideas[s.sceneId]!) : []))
  for (const s of shots) tried[baseSceneId(s.sceneId)] = [...(tried[baseSceneId(s.sceneId)] ?? []), ...s.queries]
  const found: Record<string, T2vFootageCandidate[]> = {}
  if (shots.length) {
    const realistic = t2vRealisticStyle(run.style)
    const reviewed = Object.values(history).flatMap((h) => h.evaluated.map((e) => e.providerId))
    const exclude: Record<string, string[]> = {}
    for (const s of shots) exclude[s.sceneId] = reviewed
    const aspect = row.document.settings.aspect
    const videos = await t2vFootageAgent({ shots, aspect, rewrite: false, exclude, realistic })
    const photos = await t2vPhotoAgent({ shots, aspect, realistic, exclude: new Set(reviewed) })
    // Per idea: a few videos and photos (an idea is one shot, so a short list is enough).
    const seen = new Set<string>()
    for (const s of shots) {
      const list = [...(videos[s.sceneId] ?? []).slice(0, 3), ...(photos[s.sceneId] ?? []).slice(0, 2)].filter((c) => !seen.has(c.providerId) && seen.add(c.providerId))
      if (list.length) found[s.sceneId] = list
    }
  }
  // Each line's own allowance (round-robin over its ideas); nothing is dropped first-come.
  const budgeted = trimPerScene(shots, found, allowance, baseSceneId)
  if (budgeted.dropped.length)
    logT2v('pipeline-reimagine', 'allowance trimmed ideas', { draftId: row.id, budget, used: (run.reimagineVerifyUsed ?? 0) + budgeted.used, allowance, droppedIdeas: budgeted.dropped })
  if (Object.keys(skipped).length) logT2v('pipeline-reimagine', 'rounds skipped (not counted)', { draftId: row.id, budget, used: run.reimagineVerifyUsed ?? 0, skipped })
  for (const k of Object.keys(found)) if (!budgeted.found[k]) delete found[k]
  Object.assign(found, budgeted.found)
  const withCands = budgeted.shots
  const linesWithCands = new Set(withCands.map((s) => baseSceneId(s.sceneId)))
  const pending: T2vReimaginePending = {}
  const nothing: T2vReimaginePending = {}
  for (const s of asked) if (!skipped[s.sceneId]) (linesWithCands.has(s.sceneId) ? pending : nothing)[s.sceneId] = plan[s.sceneId]!
  const none: T2vReimaginePending = {}
  for (const s of targets) if (skipped[s.sceneId]) none[s.sceneId] = { round: roundOf(s.sceneId), ideas: [] }
  const settledNow = [
    ...reimagineOutcomes(nothing, []),
    ...reimagineOutcomes(none, []).map((e) => ({ ...e, note: `skipped_${skipped[e.sceneId]}` })),
  ]
  // Candidates are kept under the line's own scene id so the finisher can ingest whichever pick wins.
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) {
    const base = baseSceneId(s.sceneId)
    candidates[base] = [...(candidates[base] ?? []), ...found[s.sceneId]!]
  }
  const jobId = withCands.length
    ? await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic: t2vRealisticStyle(run.style) })
    : null
  // A round counts when the line's ideas were searched (and verified when clips were found).
  const counted = asked.filter((s) => !skipped[s.sceneId]).map((s) => s.sceneId)
  return { jobId, tried, candidates, shots: linesWithCands.size, ideas: withCands.length, pending, settledNow, verifyUsed: budgeted.used, counted, skipped, budget, reimagineScenes }
}

/** Trim a stock-stage round to the run cap in place; false when nothing is left to check (logged). */
async function capToRunBudget(draftId: string, run: T2vPipelineRun, shots: T2vPlannedShot[], found: Record<string, T2vFootageCandidate[]>, stage: string): Promise<boolean> {
  const used = stockVerifyUsed(run)
  const left = Math.max(0, T2V_RUN_VERIFY_BUDGET - used)
  const capped = fairTrim(shots.map((s) => s.sceneId), found, left)
  if (capped.dropped) {
    logT2v('pipeline', 'run verify budget hit', { draftId, stage, budget: T2V_RUN_VERIFY_BUDGET, used, sent: capped.used, dropped: capped.dropped })
    await writeRun(draftId, (r) => {
      r.verifyBudgetHit = [...(r.verifyBudgetHit ?? []), { stage, at: new Date().toISOString(), dropped: capped.dropped }]
      return r
    })
  }
  for (const k of Object.keys(found)) delete found[k]
  Object.assign(found, capped.found)
  return capped.used > 0
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
  if (!(await capToRunBudget(row.id, run, weak, found, 'photo'))) return null
  const withCands = weak.filter((s) => found[s.sceneId]?.length)
  if (!withCands.length) return null
  const candidates = { ...(run.candidates ?? {}) }
  for (const s of withCands) candidates[s.sceneId] = [...(candidates[s.sceneId] ?? []), ...found[s.sceneId]!]
  const jobId = await enqueueVerify(row, run.story?.topic || run.story?.title || '', withCands, found, { realistic })
  return { jobId, candidates, shots: withCands.length }
}

/** Shot lengths from the assembler's shot starts; a closing end card (older drafts only) is excluded. */
export function shotLengthsFrom(starts: number[] | undefined, totalMs: number | undefined, endCard = false): number[] | undefined {
  if (!starts?.length || !totalMs) return undefined
  const sorted = [...starts].sort((a, b) => a - b)
  const lens = sorted.map((s, i) => (sorted[i + 1] ?? totalMs) - s)
  return (endCard ? lens.slice(0, -1) : lens).filter((l) => l > 0)
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
