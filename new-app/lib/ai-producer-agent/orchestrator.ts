import { approvedRoughCutSegmentArgs } from '@/lib/ai-producer-agent/assembly-segment-args'
import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { verifyEdlCaptionSync } from '@/lib/clips/cuts-quality/edl-invariant'
import { buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { toolsForPhase } from '@/lib/ai-producer-agent/tools/schemas'
import { runTool, buildToolCtx, type ToolCtx, type ToolResult } from '@/lib/ai-producer-agent/tools/registry'
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
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import { createEditorialHandoff, runEditorialRole, recoverEditorialSelections, type EditorialHandoff } from '@/lib/ai-producer-agent/specialists'
import { JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION, JUST_CHATTING_DIRECTION_VERSION } from '@/lib/ai-producer-agent/just-chatting-direction'
import { buildJustChattingEvidence } from '@/lib/ai-producer-agent/just-chatting-evidence'

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
  editorialHandoff?: EditorialHandoff
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
    if (ctx.config.visualEvidenceMode === 'visual_audio' &&
        ctx.config.editMode === 'just_chatting_rough_cut') {
      // Reuse the coarse video+audio+ASR observations for inventory.
      // The legacy second inventory scan would discard ASR and re-run Gemini.
      const { refineVisualStoryEvidence } = await import('@/lib/ai-producer-agent/tools/analysis')
      await refineVisualStoryEvidence(ctx,budget)
    } else if (ctx.sources.length > 1 || run.outputType !== 'single_payoff') {
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
  if (ctx.config.editMode === 'just_chatting_rough_cut') {
    out.editorialHandoff = await createEditorialHandoff(ctx, out, budget, instruction)
  }
  if (out.editorialHandoff) {
    await assembleApprovedRoughCut(ctx, out, budget)
  }
  const messages: LunaMessage[] = [
    { role: 'system', content: [
      buildAgentSystemPromptForModel(ctx.promptArgs),
      ...(out.editorialHandoff ? [FILM_EDITING_THEORY, SPECIALIST_ROLES.assembly, JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION.assembly] : []),
    ].join('\n\n') },
    {
      role: 'user',
      content: JSON.stringify({
        task: ctx.config.roughCutIntent === 'highlights' ? 'make_source_highlights' : ctx.config.editMode === 'just_chatting_rough_cut' ? 'make_long_form_rough_cut' : 'make_edit',
        outputIndex: out.index,
        outputType: out.outputType,
        config: ctx.config,
        instruction,
        sources: ctx.sources.map((s) => ({ sourceId: s.sourceId, durationMs: s.durationMs, rangeMs: s.rangeMs, title: s.title })),
        transcriptWordCount: ctx.cache.words?.length ?? 0,
        editorialGoal: ctx.config.roughCutIntent === 'highlights'
          ? 'Curate distinct self-contained interesting moments across the authorized recording; no continuous-scene breath-cut reel, no unrelated padding.'
          : ctx.config.editMode === 'just_chatting_rough_cut'
            ? 'Select complete coherent conversations with a real ending. Use bounded transcript evidence.' : undefined,
        moments: ctx.cache.momentsSummary,
        inventory: ctx.cache.inventory,
        editorialHandoff: out.editorialHandoff ?? undefined,
        assembleOnlyApprovedCuts: Boolean(out.editorialHandoff),
        usedPayoffs: ctx.usedPayoffs,
      }),
    },
  ]
  // The specialists already chose the cut. Picture assembly is deterministic:
  // never rely on the model to issue create_project/add_clip_segment N times.
  if (!out.editorialHandoff) await loop(ctx, out, budget, messages, 'plan')
  if (out.editorialHandoff) {
    const approved = out.editorialHandoff.cutPlan
    const assembled = out.builder?.segs ?? []
    if (assembled.length !== approved.length || assembled.some((seg, i) =>
      seg.srcInMs !== approved[i]?.startMs || seg.srcOutMs !== approved[i]?.endMs)) {
      throw new Error('specialist_assembly_does_not_match_approved_cut_plan')
    }
  }
  if (!out.lastValid) {
    out.notes.push('no valid plan')
    return
  }
  // Persist the valid editable project before model QA; review cannot erase the draft.
  await apply(ctx, out, budget)
  if (out.editorialHandoff && out.lastValid) {
    try {
    const review = await runEditorialRole(ctx, out, budget, 'qa', {
      outline: out.editorialHandoff.outline,
      storyFinisher: out.editorialHandoff.finisher ?? null,
      highlightsFinisher: out.editorialHandoff.highlightsFinisher ?? null,
      selections: out.editorialHandoff.cutPlan,
      ...(ctx.config.visualEvidenceMode==='visual_audio' && ctx.cache.visualEvidence ? {
        visualAudioEvidence: ctx.cache.visualEvidence,
        selectedVisualBeats:out.editorialHandoff.outline.visualBeats??[],
        includedVisualActions:out.editorialHandoff.visualActions??[],
        omittedVisualActions:out.editorialHandoff.visualActionOmissions??[],
        visualQAInstruction:'Compare candidate visual action/reaction/payoff evidence against final selections. Flag a high-value visual event omitted from the actual edit if it clearly belongs in this story, with evidence timestamps and the reason it matters. Also inspect whether selected visual actions have their visible setup and reaction. Do not assume a candidate must be included merely because Gemini rated it highly; do not invent visual continuity or claim audio seam quality without listening.',
      } : {}),
      timeline: out.lastValid,
      validation: out.lastValidation,
      actualTranscriptEvidence: buildJustChattingEvidence(
        ctx.cache.words ?? [], ctx.sources[0]!.rangeMs!, out.editorialHandoff.cutPlan,
      ),
      editorialBaseline: ctx.config.roughCutIntent !== 'highlights' && ctx.config.targetLengthS[1] <= 105
        ? 'Judge one complete, coherent story and exact word boundaries ONLY. Do not score runtime, 90-second compliance, shortness, or the number of passages.'
        : undefined,
      instruction: ctx.config.roughCutIntent === 'highlights'
        ? 'HIGHLIGHTS QA: Inspect actual opening and closing transcript words for EVERY selected moment and all joins. Use the Highlights Finisher verified landings: confirm every promised quote remains in the final footage and each highlight actually ends naturally. Check that no unrelated talk after a landing, incomplete opening, missing independent payoff, or overlong segment remains. Require distinct source moments, not breath cuts. If source words do not support the finishing choices, pass=false with precise timestamps. No rendered audio was supplied; acoustic joins require listening review.'
        : 'EDITORIAL BASELINE (NO LENGTH TARGET): Judge only whether ONE specific story is coherently told from a clear opening through an actual recorded ending, whether the moments belong to that story, whether each selected passage begins and ends naturally, and whether any important connecting information is missing or repeated. Ignore duration entirely: two, three, four or more minutes are acceptable. Do not fail QA due to runtime or number of passages. Flag precise transcript words and source timestamps for every true editorial issue. Do not infer audio quality without listening.',
    })
    out.editorialHandoff.review = { pass: review.pass === true, issues: review.issues as string[] }
    out.notes.push(...out.editorialHandoff.review.issues.slice(0, 10).map((issue) => 'Editorial QA: ' + issue))
    if (!out.editorialHandoff.review.pass) {
      // QA findings belong on the editable draft. Do not discard an otherwise
      // valid rough cut solely because the editorial review asks for revisions.
      out.notes.push('Editorial QA requested revisions; editable rough cut retained')
    }
    } catch (error) {
      out.notes.push('Editorial QA could not complete: ' + String((error as Error)?.message ?? error).slice(0, 250))
    }
  }
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

/**
 * Deterministically turn approved selections into an actual editor timeline.
 * A model's missing create_project calls must never prevent project creation.
 */
async function assembleApprovedRoughCut(ctx: ToolCtx, out: OutputState, budget: Budget) {
  const source = ctx.sources[0]
  const proposed = out.editorialHandoff?.cutPlan
  if (!source?.sourceId || !source.rangeMs || !proposed?.length) throw new Error('rough_cut_approved_selections_missing')
  // Short Story baseline: the model made the editorial decision, and the
  // word IDs were already converted to ORIGINAL source timestamps. Do not
  // snap, recover, re-rank, drop or substitute these selected cuts during
  // assembly. Record EXACTLY what we received and what will be executed.
  const directStory = ctx.config.editMode === 'just_chatting_rough_cut' &&
    ctx.config.roughCutIntent !== 'highlights' && ctx.config.targetLengthS[1] <= 105
  const recovered = directStory ? null : recoverEditorialSelections(
    proposed, source.rangeMs, ctx.cache.words ?? [], out.editorialHandoff?.footage,
  )
  const verifiedFinisher = Boolean(out.editorialHandoff!.finisher || out.editorialHandoff!.highlightsFinisher)
  const cuts = directStory || verifiedFinisher ? proposed
    : recovered!.selections.length ? recovered!.selections : out.editorialHandoff!.footage
  if (!cuts.length) throw new Error('rough_cut_no_usable_source_segments')
  out.editorialHandoff!.cutPlan = cuts
  await logAiProducerStep({
    runId: ctx.runId, stepIndex: ++budget.steps,
    phase: 'plan', tool: directStory ? 'rough_cut_direct_cut_execution' : 'rough_cut_final_boundary_check',
    kind: directStory ? 'system' : 'validate',
    argsSummary: JSON.stringify({
      mode: directStory ? 'exact_model_selected_timestamps' : 'legacy_boundary_recovery',
      sourceRangeMs:source.rangeMs,
      storyOutline:out.editorialHandoff!.outline,
      originalCuts: proposed,
      appliedCuts: cuts,
      sourceGroundedVisualActions:out.editorialHandoff!.visualActions??[],
      visualActionOmissions:out.editorialHandoff!.visualActionOmissions??[],
      changedByAssembly: cuts.some((c,i)=>c.startMs!==proposed[i]?.startMs||c.endMs!==proposed[i]?.endMs),
    }).slice(0,12000),
    resultSummary: JSON.stringify({
      cuts:cuts.length,durationMs:cuts.reduce((n,c)=>n+c.endMs-c.startMs,0),
      directStory, dropped:recovered?.dropped??0,
      unsafeEdges:recovered?.unsafeEdges??0,
      preservedFinisherEdges:verifiedFinisher,
    }),
  })
  const title = `AI Producer ${ctx.config.roughCutIntent === 'highlights' ? 'highlights' : 'rough cut'} · ${source.title ?? 'stream'}`
  const created = await sysTool(ctx, budget, 'plan', 'create_project', {
    title, sources: [source.sourceId], aspect: '16:9', outputType: out.outputType,
  }, out)
  if (!created.ok || !out.builder) throw new Error('rough_cut_builder_creation_failed: ' + created.summary)
  out.builder.preserveApprovedEdges = true
  for (const [index,cut] of cuts.entries()) {
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
      tool:'rough_cut_segment_execution_attempt',kind:'system',
      argsSummary:JSON.stringify({index,sourceId:source.sourceId,startMs:cut.startMs,endMs:cut.endMs,beat:cut.beat,reason:cut.reason}),
      resultSummary:'Applying original model-selected source timestamps',
    })
    const added = await sysTool(ctx, budget, 'plan', 'add_clip_segment',
      approvedRoughCutSegmentArgs(source.sourceId, cut), out)
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
      tool:'rough_cut_segment_execution_result',kind:'system',
      argsSummary:JSON.stringify({index,startMs:cut.startMs,endMs:cut.endMs}),
      resultSummary:JSON.stringify({ok:added.ok,summary:added.summary}).slice(0,1000),
      error:added.ok?undefined:added.summary,
    })
    if (!added.ok) throw new Error('rough_cut_assembly_segment_failed: ' + added.summary)
  }
  // Only the short Story direct-cut baseline: gentle anti-click audio fades.
  // Keep every approved timestamp and picture cut exactly where Footage chose.
  if (directStory) {
    out.builder.setStoryVoiceCutFades(15)
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
      tool:'rough_cut_voice_microfades',kind:'system',
      argsSummary:JSON.stringify({
        fadeMs:15,passages:cuts.length,cutSourceTimestamps:cuts.map(c=>[c.startMs,c.endMs]),
      }),
      resultSummary:'15ms voice gain ramps at each segment start/end; source timestamps unchanged',
    })
  }
  const validation = await sysTool(ctx, budget, 'plan', 'validate_plan', {}, out)
  const report = validation.data as ValidationReport | undefined
  if (!validation.ok || !report || !Array.isArray(report.hardFailures)) {
    throw new Error('rough_cut_validation_unavailable: ' + validation.summary)
  }
  out.lastValidation = report
  await logAiProducerStep({
    runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
    tool:'rough_cut_validation_diagnostics',kind:'validate',
    argsSummary:JSON.stringify({directStory,appliedCuts:cuts}).slice(0,12000),
    resultSummary:JSON.stringify({hardFailures:report.hardFailures,warnings:report.warnings,droppedFields:report.droppedFields}).slice(0,12000),
  })
  if (report.warnings.length) out.notes.push('Rough cut review warnings: ' +
    report.warnings.map((x) => x.code + (x.atSrcMs == null ? '' : '@' + x.atSrcMs)).slice(0, 25).join(', '))
  if (report.hardFailures.length) {
    await logAiProducerStep({
      runId: ctx.runId, stepIndex: ++budget.steps,
      phase: 'plan', tool: 'rough_cut_validation_failed', kind: 'validate',
      resultSummary: JSON.stringify(report.hardFailures.map((x) => x.code)).slice(0, 1000),
    })
    throw new Error('rough_cut_validation_failed: ' + report.hardFailures.map((x) => x.code).join(','))
  }
  out.lastValid = out.builder.snapshot()
  await logAiProducerStep({
    runId: ctx.runId, stepIndex: ++budget.steps,
    phase: 'plan', tool: 'rough_cut_assembled', kind: 'system',
    resultSummary: JSON.stringify({ segments: cuts.length, durationMs: cuts.reduce((n, c) => n + c.endMs - c.startMs, 0) }),
  })
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
    const availableTools = toolsForPhase(phase, bs)
    const tools = out.editorialHandoff
      ? availableTools.filter((t) => !['find_moments', 'analyze_visual', 'reorder_segments', 'trim_segment', 'cut_range', 'set_speed', 'set_freeze'].includes(t.name))
      : availableTools
    const res = await lunaChat({ messages, tools, toolChoice: 'required' })
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
      let blocked = Boolean(out.editorialHandoff) && !tools.some((t) => t.name === name)
      if (out.editorialHandoff && name === 'add_clip_segment') {
        const a = args as { sourceId?: string; srcInMs?: number; srcOutMs?: number } | null
        const approved = out.editorialHandoff.cutPlan
        if (!a || a.sourceId !== ctx.sources[0]?.sourceId ||
          !approved.some((seg) => seg.startMs === a.srcInMs && seg.endMs === a.srcOutMs) ||
          out.builder?.segs.some((seg) => seg.srcInMs === a.srcInMs && seg.srcOutMs === a.srcOutMs)) blocked = true
      }
      const r: ToolResult = blocked
        ? { ok: false, summary: 'specialist_assembly_tool_or_range_not_approved', costUsd: 0 }
        : await runTool(ctx, name, args, out, budget)
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

      if (name === 'validate_plan' && r.ok && r.data && Array.isArray((r.data as ValidationReport).hardFailures)) {
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
          const rep = v.data as ValidationReport | undefined
          if (!v.ok || !rep || !Array.isArray(rep.hardFailures)) {
            out.notes.push('finish_edit validation unavailable: ' + v.summary)
            if (!out.builder) throw new Error('rough_cut_no_builder')
            continue
          }
          out.lastValidation = rep
          if (!rep.hardFailures.length) out.lastValid = out.builder!.snapshot()
        }
        out.story = (args as { story?: string } | null)?.story
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
          specialists: o.editorialHandoff ? {
            version: JUST_CHATTING_DIRECTION_VERSION,
            story: o.editorialHandoff.outline,
            curatedCount: o.editorialHandoff.footage.length,
            approvedCuts: o.editorialHandoff.cutPlan,
            review: o.editorialHandoff.review,
          } : undefined,
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
