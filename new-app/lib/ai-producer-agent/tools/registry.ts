import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { resolveAiProducerSources } from '@/lib/server/ai-producer-agent/resolve-sources'
import { loadRoughCutWords } from '@/lib/server/ai-producer-agent/rough-cut-source'
import { roughCutSourceWindow,clipAgentSourceWindow } from '@/lib/ai-producer-agent/rough-cut-window'
import { createAiProducerOutputProject } from '@/lib/server/ai-producer-agent/create-output-project'
import { writeClipEditsOrThrow } from '@/lib/server/clips/write-clip-edits'
import type { AiProducerRunConfig, AiProducerSourceRef } from '@/lib/ai-producer-agent/types'
import type { AgentPromptContext } from '@/lib/ai-producer-agent/prompts'
import type { Budget } from '@/lib/ai-producer-agent/budget'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import { validateDraft, type ValidationCtx } from '@/lib/ai-producer-agent/validate'
import { validateToolArgs } from '@/lib/ai-producer-agent/tools/validate-args'
import * as analysis from '@/lib/ai-producer-agent/tools/analysis'
import * as edit from '@/lib/ai-producer-agent/tools/edit'
import { renderPreview } from '@/lib/server/ai-producer-agent/preview'
import type { ClipEditsV2, ClipWord } from '@/lib/clips/edits'
import type { VisualMomentEvidence } from '@/lib/ai-producer-agent/visual-evidence'
import { buildRmsLookup } from '@/lib/ai-producer-agent/tools/analysis'

export type ToolResult = { ok: boolean; summary: string; data?: unknown; costUsd?: number }

export type ToolCtx = {
  runId: string
  workspaceId: string
  createdById: string
  sources: AiProducerSourceRef[]
  config: AiProducerRunConfig
  cache: {
    moments?: Record<string, unknown>[]
    momentsSummary?: Record<string, unknown>[]
    visualEvidence?: { coarse: VisualMomentEvidence[]; focused: VisualMomentEvidence[]; metadata: Record<string,unknown> }
    inventory?: { links?: { kind: string }[]; beats?: unknown[] }
    inventorySummary?: unknown
    words?: ClipWord[]
    laughs?: [number, number][]
    bursts?: { s: number; e: number; speech: boolean }[]
    rmsFrames?: { tMs: number; rms: number }[]
    visual?: Record<string, unknown>
    selfReviewPass?: boolean
    selfReviewIssues?: unknown[]
  }
  usedPayoffs: [number, number][]
  totalSourceMs: number
  decideInput: { instruction: string | null; momentCount: number; multiSource: boolean }
  promptArgs: AgentPromptContext
  rmsLookup?: ReturnType<typeof buildRmsLookup>
  markUsed(out: OutputState): void
  createOutputProject(out: OutputState): Promise<{ projectId: string; clipId: string }>
  writeDraft(out: OutputState, draft: ClipEditsV2): Promise<void>
  wordsFor(out: OutputState): Promise<ClipWord[]>
  validationCtx(out: OutputState): ValidationCtx
}

export async function buildToolCtx(run: {
  id: string
  workspaceId: string
  createdById: string | null
  genre: string
  outputType: string
  platform: string
  instruction: string | null
  config: unknown
  sourceSnapshot: unknown
}, budget: Budget): Promise<ToolCtx> {
  const config = (run.config ?? {}) as AiProducerRunConfig
  const sourcesRaw = (run.sourceSnapshot ?? []) as AiProducerSourceRef[]
  const allSources = await resolveAiProducerSources(run.workspaceId, sourcesRaw)
  const lockedSingleSource = config.storyMode !== 'multi_source_story_v1'
  const agentClip = config.storyMode === 'clip_moment_v1' || config.storyMode === 'clip_story_v1'
  const sources = agentClip ? allSources.map(clipAgentSourceWindow)
    : lockedSingleSource && config.editMode === 'just_chatting_rough_cut'
      ? allSources.map(roughCutSourceWindow) : allSources
  const roughWords = lockedSingleSource && config.editMode === 'just_chatting_rough_cut'
    ? await loadRoughCutWords(run.workspaceId, sources[0]!) : []
  const totalSourceMs = sources.reduce((acc, s) => acc + (s.durationMs ?? 0), 0)
  const ctx: ToolCtx = {
    runId: run.id,
    workspaceId: run.workspaceId,
    createdById: run.createdById ?? 'system',
    sources,
    config,
    cache: { words: roughWords, rmsFrames: [], bursts: [] },
    usedPayoffs: [],
    totalSourceMs,
    decideInput: {
      instruction: run.instruction,
      momentCount: 0,
      multiSource: sources.length > 1,
    },
    promptArgs: {
      genre: run.genre,
      outputType: run.outputType as AgentPromptContext['outputType'],
      resolvedOutputType: config.resolvedOutputType,
      platform: run.platform as AgentPromptContext['platform'],
      editMode: config.editMode,
    },
    markUsed(out) {
      for (const seg of out.builder?.segs ?? []) {
        if (seg.beat === 'payoff') ctx.usedPayoffs.push([seg.srcInMs, seg.srcOutMs])
      }
    },
    async createOutputProject(out) {
      const segs = out.builder?.segs ?? []
      const srcIns = segs.map((s) => s.srcInMs)
      const srcOuts = segs.map((s) => s.srcOutMs)
  const clipStartMs = Math.max(0, (srcIns.length ? Math.min(...srcIns) : 0) - 2000)
      const clipEndMs = (srcOuts.length ? Math.max(...srcOuts) : clipStartMs + 30_000) + 2000
      const title =
        out.pendingTitle ??
        `AI Producer: ${out.outputType} · ${sources[0]?.title ?? 'edit'} · ${new Date().toISOString().slice(0, 10)}`
      return createAiProducerOutputProject({
        workspaceId: run.workspaceId,
        createdById: ctx.createdById,
        runId: run.id,
        title,
        sourceProjectId: sources[0]!.projectId!,
        clipStartMs,
        clipEndMs,
      })
    },
    async writeDraft(out, draft) {
      if (!out.clipId || !out.projectId) throw new Error('clip_missing')
      const clip = await getPrisma().clip.findUniqueOrThrow({ where: { id: out.clipId } })
      const bounds = { clipStartMs: clip.startMs, clipEndMs: clip.endMs, trimMinMs: 0, trimMaxMs: clip.endMs }
      await writeClipEditsOrThrow(out.clipId, bounds, clip.editsSaveVersion, () => draft)
    },
    async wordsFor() {
      return ctx.cache.words ?? []
    },
    validationCtx(out) {
      return {
        words: ctx.cache.words ?? [],
        laughs: ctx.cache.laughs ?? [],
        reactions: [],
        bursts: ctx.cache.bursts ?? [],
        layoutAt: () => ({ contentType: 'irl', mode: 'fit_blur' }),
        outputType: out.outputType,
        editMode: config.editMode,
        directStoryWordCuts: config.editMode === 'just_chatting_rough_cut' &&
          config.roughCutIntent !== 'highlights' && config.targetLengthS[1] <= 105 &&
          Boolean(out.editorialHandoff) && Boolean(out.builder?.preserveApprovedEdges),
        sourceRangeMs: sources[0]?.rangeMs,
        audioEvidenceAvailable: Boolean(ctx.cache.rmsFrames?.length),
        targetLengthS: config.targetLengthS,
        memeSfx: config.memeSfx,
        payoffSrc: (out.builder?.segs ?? []).filter((s) => s.beat === 'payoff').map((s) => [s.srcInMs, s.srcOutMs] as [number, number]),
      }
    },
  }
  ctx.rmsLookup = buildRmsLookup(ctx.cache.rmsFrames ?? [])
  return ctx
}

export async function runTool(
  ctx: ToolCtx,
  name: string,
  args: unknown,
  out: OutputState,
  budget: Budget,
): Promise<ToolResult> {
  const parsed = validateToolArgs(name, args)
  if (!parsed.ok) return { ok: false, summary: parsed.error }
  const a = parsed.value
  switch (name) {
    case 'find_moments':
      return analysis.findMoments(ctx, budget, a)
    case 'get_transcript':
      return analysis.getTranscript(ctx, a)
    case 'analyze_visual':
      return analysis.analyzeVisual(ctx, budget, a)
    case 'get_audio_energy':
      return analysis.audioEnergy(ctx, budget, a)
    case 'get_layout_info':
      return analysis.layoutInfo(ctx)
    case 'get_beats':
      return analysis.beats()
    case 'create_project':
      return edit.createProject(ctx, out, a)
    case 'add_clip_segment':
      return edit.addSegment(ctx, out, a)
    case 'trim_segment':
      return edit.trimSegment(out, a)
    case 'split_segment':
      return edit.splitSegment(out, a)
    case 'cut_range':
      return edit.cutRange(out, a)
    case 'reorder_segments':
      return edit.reorder(out, a)
    case 'set_transition':
      return edit.setTransition(out, a)
    case 'set_split_edit':
      return edit.setSplitEdit(out, a)
    case 'add_caption_track':
      return edit.setCaptions(out, a)
    case 'set_layout':
      return edit.setLayout(out, a)
    case 'add_zoom':
      return edit.addZoom(out, a)
    case 'add_text':
      return edit.addText(out, a)
    case 'add_music':
      return edit.addMusic(out, a)
    case 'add_sfx':
      return edit.addSfx(out, a)
    case 'set_speed':
      return edit.setSpeed(out, a)
    case 'set_freeze':
      return edit.setFreeze(out, a)
    case 'set_loudness':
      return edit.setLoudness(out, a)
    case 'preview_render':
      return renderPreview(ctx, out, a)
    case 'self_review':
      return analysis.selfReview(ctx, a)
    case 'validate_plan': {
      if (!out.builder) return { ok: false, summary: 'no builder' }
      const rep = validateDraft(out.builder, ctx.validationCtx(out))
      return { ok: true, summary: `${rep.hardFailures.length} hard`, data: rep }
    }
    case 'finish_edit':
      return edit.finishEdit(out, a)
    default:
      return { ok: false, summary: `unknown tool ${name}` }
  }
}
