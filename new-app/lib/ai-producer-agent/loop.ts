import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import { buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { resolveAutoOutputType, defaultTargetLengthS } from '@/lib/ai-producer-agent/decide'
import { assertGenreSupported } from '@/lib/ai-producer-agent/rulepacks/index'
import { validateEditPlan, validateHardIssues } from '@/lib/ai-producer-agent/validate'
import type { EditPlanJson } from '@/lib/ai-producer-agent/types'
import type { ClipBounds } from '@/lib/clips/edits'
import { AI_PRODUCER_AGENT_MAX_STEPS } from '@/lib/ai-producer-agent/flags'
import { createAiProducerOutputProject } from '@/lib/server/ai-producer-agent/create-output-project'
import { enqueueAiProducerAnalyzeJob, waitForClipJobDone } from '@/lib/server/ai-producer-agent/enqueue-analyze'
import { resolveAiProducerSources } from '@/lib/server/ai-producer-agent/resolve-sources'
import type { AiProducerRunConfig, AiProducerSourceRef } from '@/lib/ai-producer-agent/types'
import { normalizeEdits } from '@/lib/clips/edits'
import { verifyEdlCaptionSync } from '@/lib/clips/cuts-quality/edl-invariant'

function planFromMoments(
  run: { genre: string; platform: string; instruction: string | null },
  resolvedOutputType: EditPlanJson['outputType'],
  config: AiProducerRunConfig,
  sources: AiProducerSourceRef[],
  moments: Array<Record<string, unknown>>,
): EditPlanJson {
  const top = moments[0] ?? {}
  const startS = Number(top.start_s ?? 0)
  const endS = Number(top.end_s ?? startS + 20)
  const srcInMs = Math.round(startS * 1000)
  const srcOutMs = Math.round(endS * 1000)
  return {
    genre: run.genre,
    outputType: resolvedOutputType,
    platform: run.platform,
    targetLengthS: config.targetLengthS,
    story: String(top.what_happened ?? run.instruction ?? 'Auto plan from top moment'),
    segments: [
      {
        id: 's1',
        sourceId: String(top.sourceId ?? sources[0]?.sourceId ?? 'src_A'),
        srcInMs,
        srcOutMs,
        beat: 'payoff',
        rules: ['HOOK-01', 'CORE-03'],
      },
    ],
    layout: { mode: 'auto_by_content', fallback: 'fit_blur' },
    captions: { presetId: 'bold_pop', wordsPerLine: 3 },
    selfReviewExpectations: ['payoff present', 'no cut inside laugh'],
  }
}

export async function runAiProducerAgentLoop(runId: string) {
  const prisma = getPrisma()
  const run = await prisma.aiProducerAgentRun.findUnique({ where: { id: runId } })
  if (!run) return
  let step = 0
  const bump = async (tool: string, phase: string, resultSummary: string) => {
    if (step >= AI_PRODUCER_AGENT_MAX_STEPS) return
    await logAiProducerStep({ runId, stepIndex: step++, phase, tool, resultSummary })
  }

  await prisma.aiProducerAgentRun.update({ where: { id: runId }, data: { status: 'running', phase: 'ingest' } })
  const config = (run.config ?? {}) as AiProducerRunConfig
  let configMut: AiProducerRunConfig = { ...config }
  const sourcesRaw = (run.sourceSnapshot ?? []) as AiProducerSourceRef[]
  assertGenreSupported(run.genre)
  const userOutputType = run.outputType as 'single_payoff' | 'montage' | 'story' | 'auto'
  const sources = await resolveAiProducerSources(run.workspaceId, sourcesRaw)
  await bump('ingest', 'ingest', `${sources.length} sources`)

  const anchorProjectId = sources[0]?.projectId
  if (!anchorProjectId) throw new Error('anchor_project_required')

  await prisma.aiProducerAgentRun.update({ where: { id: runId }, data: { phase: 'inventory' } })
  const job = await enqueueAiProducerAnalyzeJob({
    runId,
    projectId: anchorProjectId,
    mode: 'inventory',
    sources,
    targetClipLenS: configMut.targetLengthS?.[1] ?? 30,
  })
  await bump('find_moments', 'inventory', `job ${job.id}`)
  const finished = await waitForClipJobDone(job.id).catch(() => null)
  const payload = (finished?.payload ?? {}) as { analyzeResult?: { inventory?: unknown[]; moments?: unknown[] } }
  let moments = (payload.analyzeResult?.inventory ?? payload.analyzeResult?.moments ?? []) as Array<
    Record<string, unknown>
  >
  if (!moments.length && sources[0]?.rangeMs) {
    moments = [
      {
        sourceId: sources[0].sourceId,
        start_s: (sources[0].rangeMs[0] ?? 0) / 1000,
        end_s: ((sources[0].rangeMs[1] ?? 30_000) as number) / 1000,
        what_happened: run.instruction ?? 'Fallback span',
      },
    ]
  }

  const resolvedType: EditPlanJson['outputType'] =
    userOutputType === 'auto'
      ? resolveAutoOutputType({
          instruction: run.instruction,
          momentCount: moments.length,
          multiSource: sources.length > 1,
        })
      : userOutputType
  if (userOutputType === 'auto') {
    await bump('decide_output_type', 'decide', resolvedType)
    configMut = {
      ...configMut,
      resolvedOutputType: resolvedType,
      targetLengthS: defaultTargetLengthS(resolvedType),
    }
    await prisma.aiProducerAgentRun.update({
      where: { id: runId },
      data: { config: configMut as object },
    })
  }

  buildAgentSystemPromptForModel({
    genre: run.genre,
    outputType: userOutputType,
    resolvedOutputType: resolvedType,
    platform: run.platform as 'tiktok' | 'shorts' | 'reels',
  })

  await prisma.aiProducerAgentRun.update({ where: { id: runId }, data: { phase: 'plan' } })
  let plan = planFromMoments(run, resolvedType, configMut, sources, moments)
  let hard = validateHardIssues(validateEditPlan(plan))
  let replans = 0
  while (hard.length && replans < 2) {
    replans += 1
    plan = planFromMoments(run, resolvedType, configMut, sources, moments.slice(replans))
    hard = validateHardIssues(validateEditPlan(plan))
  }
  await bump('validate_plan', 'plan', hard.length ? `hard=${hard.length}` : 'ok')

  await prisma.aiProducerAgentRun.update({ where: { id: runId }, data: { phase: 'apply' } })
  const bounds: ClipBounds = {
    clipStartMs: plan.segments[0]?.srcInMs ?? 0,
    clipEndMs: plan.segments[0]?.srcOutMs ?? 30_000,
    trimMinMs: 0,
    trimMaxMs: 3_600_000,
  }
  const builder = new DraftEditsBuilder(bounds)
  builder.applyPlan(plan)
  const draft = normalizeEdits(builder.edits, bounds)
  const inv = verifyEdlCaptionSync([], draft)
  if (!inv.ok) throw new Error(`edl_invariant:caption=${inv.captionMismatches},dur=${inv.durationMismatchMs}`)
  const title = `AI Producer: ${resolvedType} · ${sources[0]?.title ?? 'edit'} · ${new Date().toISOString().slice(0, 10)}`
  const created = await createAiProducerOutputProject(run.workspaceId, sources, draft, title)
  const roundTrip = normalizeEdits(draft, bounds)
  if (JSON.stringify(roundTrip) !== JSON.stringify(draft)) {
    throw new Error('edits_roundtrip_failed')
  }
  await bump('create_project', 'apply', created.projectId)

  await prisma.aiProducerAgentRun.update({
    where: { id: runId },
    data: {
      status: 'ready',
      phase: 'done',
      resultProjectId: created.projectId,
      resultClipId: created.clipId,
      draftEdits: draft as object,
      producerNotes: { plan, hardIssues: hard, replans },
      finishedAt: new Date(),
    },
  })
  await bump('finish', 'done', created.clipId)
}
