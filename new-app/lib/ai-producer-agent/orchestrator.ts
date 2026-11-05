import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { verifyEdlCaptionSync } from '@/lib/clips/cuts-quality/edl-invariant'
import { buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { toolsForPhase } from '@/lib/ai-producer-agent/tools/schemas'
import { runTool, buildToolCtx, type ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import { summarizeToolResult, compactHistory } from '@/lib/ai-producer-agent/summarize'
import type { ValidationReport } from '@/lib/ai-producer-agent/validate'
import type { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { planOutputs } from '@/lib/ai-producer-agent/multi-edit'
import { Budget, CAPS } from '@/lib/ai-producer-agent/budget'
import { logAiProducerStep, redactArgs } from '@/lib/ai-producer-agent/log'
import type { AiProducerPhase } from '@/lib/ai-producer-agent/phases'
import { estimateLunaUsd } from '@/lib/ai-producer-agent/cost'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { ClipEditsV2 } from '@/lib/clips/edits'

export type Phase = AiProducerPhase

export type OutputState = {
  index: number
  outputType: 'single_payoff' | 'montage' | 'story'
  builder: DraftEditsBuilder | null
  projectId?: string
  clipId?: string
  replans: number
  fixLoops: number
  lastValidation?: ValidationReport
  lastValid?: ClipEditsV2
  renderId?: string
  notes: string[]
  story?: string
  pendingTitle?: string
  pendingSources?: string[]
}

const activeRuns = new Set<string>()

export async function runAiProducerAgent(runId: string): Promise<void> {
  if (activeRuns.has(runId)) return
  activeRuns.add(runId)
  try {
    await runAiProducerAgentInner(runId)
  } finally {
    activeRuns.delete(runId)
  }
}

async function runAiProducerAgentInner(runId: string): Promise<void> {
  const prisma = getPrisma()
  const run = await prisma.aiProducerAgentRun.findUniqueOrThrow({ where: { id: runId } })
  if (['ready', 'done', 'failed', 'capped', 'canceled'].includes(run.status)) return

  const budget = new Budget()
  const ctx = await buildToolCtx(run, budget)
  const outputs: OutputState[] = []
  let status: 'done' | 'capped' | 'failed' = 'done'
  let error: string | undefined

  await setRunStatus(runId, 'running', 'ingest')
  try {
    await sysTool(ctx, budget, 'ingest', 'find_moments', {
      mode: 'best_moments', limit: ctx.config.editMode === 'just_chatting_rough_cut' ? 30 : 12,
      targetClipLenS: ctx.config.editMode === 'just_chatting_rough_cut' ? 60 : undefined,
    })
    if (ctx.config.editMode === 'just_chatting_rough_cut' && !ctx.cache.moments?.length) {
      throw new Error('rough_cut_requires_real_video_analysis')
    }
    if (ctx.sources.length > 1 || run.outputType !== 'single_payoff') {
      await sysTool(ctx, budget, 'inventory', 'find_moments', { mode: 'inventory' })
    }
    ctx.decideInput.momentCount = ctx.cache.moments?.length ?? 0
    for (const [i, t] of planOutputs(ctx, { outputType: run.outputType as import('@/lib/ai-producer-agent/types').AiProducerOutputType, config: ctx.config }).entries()) {
      outputs.push({ index: i, outputType: t, builder: null, replans: 0, fixLoops: 0, notes: [] })
    }
    for (const out of outputs) {
      if (out.index > 0 && (budget.state() !== 'ok' || budget.geminiUsd >= 0.8 * CAPS.geminiUsd)) {
        out.notes.push('skipped: budget')
        continue
      }
      await runOneOutput(ctx, out, budget, run.instruction)
      if (out.story) ctx.markUsed(out)
    }
    if (budget.cappedBy) status = 'capped'
    if (!outputs.some((o) => o.projectId)) {
      status = 'failed'
      error = 'no valid plan for any output'
    }
  } catch (err) {
    status = 'failed'
    error = String((err as Error)?.message ?? err).slice(0, 2000)
  } finally {
    await finishRun(ctx, outputs, budget, status, error)
  }
}

async function runOneOutput(ctx: ToolCtx, out: OutputState, budget: Budget, instruction: string | null) {
  const messages: LunaMessage[] = [
    { role: 'system', content: buildAgentSystemPromptForModel(ctx.promptArgs) },
    {
      role: 'user',
      content: JSON.stringify({
        task: ctx.config.editMode === 'just_chatting_rough_cut' ? 'make_long_form_rough_cut' : 'make_edit',
        outputIndex: out.index,
        outputType: out.outputType,
        config: ctx.config,
        instruction,
        sources: ctx.sources.map((s) => ({ sourceId: s.sourceId, durationMs: s.durationMs, rangeMs: s.rangeMs, title: s.title })),
        transcriptWordCount: ctx.cache.words?.length ?? 0,
        editorialGoal: ctx.config.editMode === 'just_chatting_rough_cut'
          ? 'Select complete, coherent conversational sections from all twenty minutes; do not make a shorts montage. Use get_transcript in bounded ranges before deciding cut boundaries.' : undefined,
        moments: ctx.cache.momentsSummary,
        inventory: ctx.cache.inventory,
        usedPayoffs: ctx.usedPayoffs,
      }),
    },
  ]
  await loop(ctx, out, budget, messages, 'plan')
  if (!out.lastValid) {
    out.notes.push('no valid plan')
    return
  }
  await apply(ctx, out, budget)
  for (; out.fixLoops < CAPS.maxFixLoops && budget.state() !== 'hard'; out.fixLoops++) {
    const pr = await sysTool(ctx, budget, 'preview_render', 'preview_render', { quality: 'draft' }, out)
    if (!pr.ok) {
      out.notes.push('preview_render failed: ' + pr.summary)
      break
    }
    out.renderId = (pr.data as { renderId: string }).renderId
    const sr = await sysTool(ctx, budget, 'self_review', 'self_review', { renderId: out.renderId }, out)
    const review = sr.data as { pass: boolean; issues: { check: string; atOutMs?: number; detail: string }[] }
    if (!sr.ok || review.pass) break
    messages.push({
      role: 'user',
      content: JSON.stringify({
        selfReview: review.issues.slice(0, 20),
        fixLoop: out.fixLoops + 1,
        instruction: 'Fix with edit tools, then validate_plan, then finish_edit.',
      }),
    })
    const before: ClipEditsV2 | undefined = out.lastValid
    await loop(ctx, out, budget, messages, 'self_review')
    if (out.lastValid !== before && out.lastValid) await ctx.writeDraft(out, out.lastValid)
  }
}

async function loop(ctx: ToolCtx, out: OutputState, budget: Budget, messages: LunaMessage[], start: Phase) {
  let phase: Phase = start
  let wrapSent = false
  while (true) {
    const bs = budget.state()
    if (bs === 'hard') {
      out.notes.push(`hard cap (${budget.cappedBy}); using best valid plan`)
      return
    }
    if (bs === 'soft' && !wrapSent) {
      wrapSent = true
      messages.push({ role: 'user', content: '[WRAP_UP] Step budget reached. Call validate_plan, then finish_edit.' })
    }
    compactHistory(messages, budget)
    const t0 = Date.now()
    const res = await lunaChat({ messages, tools: toolsForPhase(phase, bs), toolChoice: 'required' })
    budget.steps++
    budget.addLuna(res.usage)
    await logAiProducerStep({
      runId: ctx.runId,
      stepIndex: budget.steps,
      phase,
      tool: 'luna',
      kind: 'luna',
      resultSummary: (res.message.content ?? `${res.message.tool_calls?.length ?? 0} tool calls`).slice(0, 500),
      tokensIn: res.usage?.prompt_tokens,
      tokensOut: res.usage?.completion_tokens,
      durationMs: Date.now() - t0,
    })
    messages.push(res.message)
    const calls = res.message.tool_calls ?? []
    if (!calls.length) {
      messages.push({ role: 'user', content: 'Call a tool. Use finish_edit when done.' })
      continue
    }

    for (const call of calls) {
      const name = call.function.name
      let args: unknown = null
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        args = null
      }
      const t1 = Date.now()
      const r = await runTool(ctx, name, args, out, budget)
      budget.steps++
      budget.addGemini(r.costUsd)
      await logAiProducerStep({
        runId: ctx.runId,
        stepIndex: budget.steps,
        phase,
        tool: name,
        kind: 'tool',
        argsSummary: JSON.stringify(redactArgs(args)).slice(0, 4000),
        resultSummary: r.summary,
        estUsd: r.costUsd,
        durationMs: Date.now() - t1,
        error: r.ok ? undefined : r.summary,
      })
      messages.push({ role: 'tool', tool_call_id: call.id, content: summarizeToolResult(name, r) })

      if (name === 'validate_plan' && r.ok) {
        const rep = r.data as ValidationReport
        out.lastValidation = rep
        if (!rep.hardFailures.length) {
          out.lastValid = out.builder!.snapshot()
          phase = 'apply'
        } else if (++out.replans > CAPS.maxReplans) {
          out.notes.push('replan cap reached')
          return
        } else {
          phase = 'plan'
        }
      }
      if (name === 'finish_edit' && r.ok) {
        if (!out.lastValidation || out.lastValidation.hardFailures.length) {
          const v = await runTool(ctx, 'validate_plan', {}, out, budget)
          budget.steps++
          const rep = v.data as ValidationReport
          if (!rep.hardFailures.length) out.lastValid = out.builder!.snapshot()
        }
        out.story = (args as { story?: string })?.story
        return
      }
    }
  }
}

async function apply(ctx: ToolCtx, out: OutputState, budget: Budget) {
  const t0 = Date.now()
  const { projectId, clipId } = await ctx.createOutputProject(out)
  out.projectId = projectId
  out.clipId = clipId
  await ctx.writeDraft(out, out.lastValid!)
  const words = await ctx.wordsFor(out)
  const inv = verifyEdlCaptionSync(words, out.lastValid!)
  if (!inv.ok) out.notes.push(`edl_invariant: ${inv.captionMismatches} mismatches, ${inv.durationMismatchMs}ms drift`)
  budget.steps++
  await logAiProducerStep({
    runId: ctx.runId,
    stepIndex: budget.steps,
    phase: 'apply',
    tool: 'system',
    kind: 'system',
    resultSummary: `project ${projectId} clip ${clipId}; edl ok=${inv.ok}`,
    durationMs: Date.now() - t0,
  })
}

async function sysTool(
  ctx: ToolCtx,
  budget: Budget,
  phase: Phase,
  name: string,
  args: Record<string, unknown>,
  out?: OutputState,
) {
  const stub: OutputState = out ?? {
    index: 0,
    outputType: 'single_payoff',
    builder: null,
    replans: 0,
    fixLoops: 0,
    notes: [],
  }
  const t0 = Date.now()
  const r = await runTool(ctx, name, args, stub, budget)
  budget.steps++
  budget.addGemini(r.costUsd)
  await logAiProducerStep({
    runId: ctx.runId,
    stepIndex: budget.steps,
    phase,
    tool: name,
    kind: 'tool',
    argsSummary: JSON.stringify(redactArgs(args)).slice(0, 4000),
    resultSummary: r.summary,
    estUsd: r.costUsd,
    durationMs: Date.now() - t0,
  })
  return r
}

async function setRunStatus(runId: string, status: string, phase?: string) {
  await getPrisma().aiProducerAgentRun.update({ where: { id: runId }, data: { status, phase } })
}

async function finishRun(
  ctx: ToolCtx,
  outputs: OutputState[],
  budget: Budget,
  status: 'done' | 'capped' | 'failed',
  error?: string,
) {
  const prisma = getPrisma()
  const projectIds = outputs.map((o) => o.projectId).filter(Boolean) as string[]
  const first = outputs.find((o) => o.projectId)
  const lunaUsd = estimateLunaUsd(budget.lunaIn, budget.lunaOut)
  const costUsd = lunaUsd + budget.geminiUsd
  const terminalStatus = status === 'done' ? 'ready' : status
  await prisma.aiProducerAgentRun.update({
    where: { id: ctx.runId },
    data: {
      status: terminalStatus,
      phase: 'finish',
      error: error ?? null,
      resultProjectId: first?.projectId ?? null,
      resultClipId: first?.clipId ?? null,
      outputProjectIds: toPrismaJson(projectIds),
      producerNotes: toPrismaJson({
        outputs: outputs.map((o) => ({
          index: o.index,
          projectId: o.projectId,
          clipId: o.clipId,
          notes: o.notes,
          story: o.story,
          validation: o.lastValidation,
        })),
        cappedBy: budget.cappedBy,
      }),
      costUsdEstimated: costUsd,
      geminiUsd: budget.geminiUsd,
      lunaTokensIn: budget.lunaIn,
      lunaTokensOut: budget.lunaOut,
      finishedAt: new Date(),
    },
  })
}
