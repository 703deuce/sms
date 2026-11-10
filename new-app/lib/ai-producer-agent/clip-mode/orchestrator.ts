import 'server-only'
import {createId} from '@/lib/supabase/id'

import { approvedRoughCutSegmentArgs } from '@/lib/ai-producer-agent/assembly-segment-args'

import { getPrisma } from '@/lib/server/db'
import { verifyEdlCaptionSync } from '@/lib/clips/cuts-quality/edl-invariant'
import { buildAgentSystemPromptForModel } from '@/lib/ai-producer-agent/prompts'
import { lunaChat, type LunaMessage } from '@/lib/ai-producer-agent/luna-client'
import { toolsForPhase } from '@/lib/ai-producer-agent/tools/schemas'
import { runTool, buildToolCtx, type ToolCtx, type ToolResult } from '@/lib/ai-producer-agent/tools/registry'
import { summarizeToolResult, compactHistory } from '@/lib/ai-producer-agent/summarize'
import type { ValidationReport } from '@/lib/ai-producer-agent/validate'
import type { DraftEditsBuilder } from '@/lib/ai-producer-agent/draft-edits'
import { Budget, CAPS } from '@/lib/ai-producer-agent/budget'
import { logAiProducerStep, redactArgs } from '@/lib/ai-producer-agent/log'
import type { AiProducerPhase } from '@/lib/ai-producer-agent/phases'
import { estimateLunaUsd } from '@/lib/ai-producer-agent/cost'
import { toPrismaJson } from '@/lib/server/clips/prisma-json'
import type { ClipEditsV2 } from '@/lib/clips/edits'
import { FILM_EDITING_THEORY, SPECIALIST_ROLES } from '@/lib/ai-producer-agent/film-theory'
import { createEditorialHandoff, runEditorialRole, recoverEditorialSelections, completeTranscriptWords, type EditorialHandoff } from '@/lib/ai-producer-agent/clip-mode/specialists'
import { JUST_CHATTING_EDITORIAL_DIRECTION, JUST_CHATTING_ROLE_DIRECTION, JUST_CHATTING_DIRECTION_VERSION } from '@/lib/ai-producer-agent/just-chatting-direction'
import {candidateWindows,clipCandidateLimit,overlapFraction,rankCandidate,type ClipCandidate} from '@/lib/ai-producer-agent/clip-mode/candidates'
import {storyCoverage} from '@/lib/ai-producer-agent/clip-mode/story-coverage'
import {chooseFallbackPublications,clipEditorialAudit,clipEditorialInstructions,evaluateCandidateAfterPlan,honorTargetDuration,qaTranscriptWindow,repairClipBoundaries,stitchJoinTransitions,storyPlanFromHandoff} from '@/lib/ai-producer-agent/clip-mode/editorial-safety'
import {CLIP_AGENT_EXPORT_PRESET,editVersionFromSnapshot,isUniqueConflict,queueClipExportOnce,shouldAutoExportPublishedClip,shouldAutoPlanClipMotion} from './clip-agent-export'
import {instructionAsksToCompile,mergeTopicCandidates,topicPassagesFromTranscript,topicQueryFromInstruction,whyThisClip} from '@/lib/ai-producer-agent/clip-mode/topic-search'
import {createSourceClip,publishClipScore,discardClip} from '@/lib/server/ai-producer-agent/clip-mode-store'
import {clipAgentHardSteps,clipAgentHardStepsForCandidates,clipAgentWallClockMs,clipAgentWallClockMsForCandidates,clipCandidateHardSteps,clipCandidateWallClockMs,clipQaRetryHardSteps,clipQaRetryWallClockMs} from '@/lib/ai-producer-agent/rough-cut-window'
import type {ClipWord} from '@/lib/clips/edits'
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
  contextBridges?: Array<{atMs:number;text:string;passageIndex:number}>
  suppressed?: boolean
  needsReview?: boolean
}

const activeRuns = new Set<string>()

export async function runClipAgent(runId: string): Promise<void> {
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

  const ctx = await buildToolCtx(run, new Budget())
  const budget = new Budget({
    wallClockMs: clipAgentWallClockMs(ctx.totalSourceMs),
    hardSteps: clipAgentHardSteps(ctx.totalSourceMs),
  })
  const outputs: OutputState[] = []
  let status: 'done' | 'capped' | 'failed' = 'done'
  let error: string | undefined

  await setRunStatus(runId, 'running', 'ingest')
  try {
    // Clip-only fanout. The first full-video analysis is shared by every output.
    // No classic picker jobs are created, and Producer's planner is not called.
    if(ctx.config.storyMode!=='clip_moment_v1'&&ctx.config.storyMode!=='clip_story_v1')
      throw Error('clip_runner_requires_clip_mode')
    const mode=ctx.config.storyMode==='clip_moment_v1'?'moment':'story'
    const analyzed=await sysTool(ctx,budget,'ingest','find_moments',{
      mode:'best_moments',limit:30,targetClipLenS:ctx.config.targetLengthS[1],
    })
    if(!analyzed.ok)throw Error('clip_candidate_analysis_unavailable:'+analyzed.summary)
    if(ctx.config.visualEvidenceMode==='visual_audio'){
      const {refineVisualStoryEvidence}=await import('@/lib/ai-producer-agent/tools/analysis')
      await refineVisualStoryEvidence(ctx,budget)
    }
    const source=ctx.sources[0]
    if(!source?.projectId||!source.rangeMs)throw Error('clip_source_project_missing')
    const topicQuery=topicQueryFromInstruction(run.instruction)
    const topicHits=topicQuery?topicPassagesFromTranscript(ctx.cache.words??[],topicQuery,source.rangeMs):[]
    const seeded=candidateWindows(ctx.cache.moments??[],source.rangeMs,mode,
      ctx.config.targetLengthS[1],clipCandidateLimit(source.rangeMs[1]-source.rangeMs[0],12))
    const candidates=topicHits.length
      ? mergeTopicCandidates(seeded,topicHits,source.rangeMs,ctx.config.targetLengthS[1])
      : seeded
    if(!candidates.length)throw Error('clip_no_grounded_candidate_moments')
    budget.expandLimits({
      wallClockMs:clipAgentWallClockMsForCandidates(ctx.totalSourceMs,candidates.length),
      hardSteps:clipAgentHardStepsForCandidates(ctx.totalSourceMs,candidates.length),
    })
    if(topicQuery)await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'plan',
      tool:'clip_topic_search',kind:'system',
      resultSummary:JSON.stringify({query:topicQuery,hits:topicHits.length,compile:instructionAsksToCompile(run.instruction)}).slice(0,2000)})
    await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'plan',
      tool:'clip_candidates_found',kind:'system',
      resultSummary:JSON.stringify({count:candidates.length,candidates}).slice(0,4000)})
    const heldDrafts:Array<{out:OutputState;candidate:ClipCandidate;score:number;durationSeconds:number;issues:string[];critical:boolean}>=[]
    const successful:Array<{out:OutputState;candidate:ClipCandidate;score:number;durationSeconds:number}> = []
    // Each candidate owns its transcript window, editorial agents, edit and
    // budget. One failure must never abort unrelated candidate clips.
    // Sequential execution keeps source edit and render workload bounded.
    for(const candidate of candidates){
      const out:OutputState={index:candidate.index,outputType:mode==='moment'?'single_payoff':'story',
        builder:null,replans:0,fixLoops:0,notes:[]}
      outputs.push(out)
      // Single Moment stays restricted to one local region. Story agents must
      // inspect the WHOLE authorized recording to seek genuinely separate beats.
      const contextStart=Math.max(source.rangeMs?.[0]??0,candidate.startMs-12000)
      const contextEnd=Math.min(source.rangeMs?.[1]??candidate.endMs,candidate.endMs+6500)
      const scopedWords=mode==='story'?(ctx.cache.words??[]):
        (ctx.cache.words??[]).filter((word:ClipWord)=>
          word.e*1000>=contextStart&&word.s*1000<=contextEnd)
      if(scopedWords.length<8){out.notes.push('skipped: no transcript context for candidate');continue}
      const scopedSource=mode==='story'?source:
        {...source,rangeMs:[contextStart,contextEnd] as [number,number]}
      const candidateCtx:ToolCtx={...ctx,sources:[scopedSource],
        cache:{...ctx.cache,words:scopedWords,momentsSummary:mode==='story'
          ? ctx.cache.momentsSummary
          : [{peakMs:candidate.peakMs,score:candidate.finderScore,
              description:candidate.label}]}}
      candidateCtx.createOutputProject=async (target)=>{
        const segs=target.builder?.segs??[]
        const startMs=Math.max(0,Math.min(...segs.map(seg=>seg.srcInMs))-2000)
        const endMs=Math.max(...segs.map(seg=>seg.srcOutMs))+2000
        return createSourceClip({workspaceId:ctx.workspaceId,
          sourceProjectId:source.projectId!,runId:ctx.runId,
          title:target.pendingTitle??('AI '+mode+' clip'),startMs,endMs,
          mode:ctx.config.storyMode!})
      }
      const clipBudget=new Budget({
        wallClockMs:clipCandidateWallClockMs(ctx.totalSourceMs),
        hardSteps:clipCandidateHardSteps(ctx.totalSourceMs),
        softSteps:Math.max(40,Math.floor(clipCandidateHardSteps(ctx.totalSourceMs)*0.45)),
      })
      try{
        await runOneOutput(candidateCtx,out,clipBudget,mode==='story'
          ? [run.instruction??'',
             'INDEPENDENT STORY CANDIDATE '+String(candidate.index+1)+':',
             'Anchor this distinct story at observed event '+candidate.label,
             'near original source time '+Math.round(candidate.peakMs/1000)+' seconds.',
             'Find additional relevant moments from distinct original source regions. Build one coherent complete story of whatever natural length; do not pad toward a preset.',
             'Other candidate stories must not all be a copy of the same source event.'].join(' ')
          : [run.instruction??'',
              'INDEPENDENT SINGLE-MOMENT CANDIDATE '+String(candidate.index+1)+':',
              'Anchor this clip at the finder event '+candidate.label,
              'around original source time '+Math.round(candidate.peakMs/1000)+' seconds.',
              'If the first spoken line refers backward, include ONLY the necessary preceding setup sentence or two.',
              'Inspect the next 6.5 seconds after the proposed ending for a meaning-changing qualification.',
              'Let Flow choose the natural ending. Never pad to the requested target length.'].join(' '),
          ctx.cache.words??[])
        if(!out.projectId||!out.clipId||!out.editorialHandoff?.cutPlan.length){
          out.notes.push('No valid editorial output')
          continue
        }
        const cuts=out.editorialHandoff.cutPlan
        if(mode==='story'&&!storyCoverage(cuts,ctx.config.targetLengthS[1]).separated){
          await discardClip(ctx.workspaceId,out.clipId)
          out.notes.push('Rejected: story is one continuous source passage')
          out.projectId=undefined;out.clipId=undefined
          continue
        }
        const finalCuts=cuts
        // Bind the parent transcript here. fullSourceWords is only a
        // parameter of runOneOutput; the candidate loop must not rely on it.
        const fullSourceWords=ctx.cache.words??[]
        const storyPlan=storyPlanFromHandoff(out.editorialHandoff)
        const evaluated=evaluateCandidateAfterPlan({
          cuts:finalCuts,words:fullSourceWords,storyPlan,
          qa:out.editorialHandoff.review,
        })
        const safetyRisks=evaluated.safetyRisks
        await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'plan',
          tool:'clip_editorial_safety_audit',kind:'validate',
          argsSummary:JSON.stringify({clipId:out.clipId,candidateIndex:candidate.index}),
          resultSummary:JSON.stringify({point:out.editorialHandoff.outline.logline,risks:safetyRisks,bridges:out.contextBridges}).slice(0,3600)})
        // Held drafts get their QA revisions applied executably (deterministic
        // boundary / join / opening repair) and are re-gated once. No paid retry.
        const {qaComplete,workingCuts,combinedIssues,disposition}=evaluated
        if(evaluated.repairLanded){
          out.editorialHandoff.cutPlan=workingCuts
          out.notes.push(...evaluated.repairNotes.map((n:string)=>'Editorial revision applied: '+n))
          try{
            await persistRevisedCuts(ctx,out,workingCuts)
          }catch(error){
            out.notes.push('Editorial revision persist failed; kept prior draft: '+String((error as Error).message).slice(0,180))
          }
        }
        const durationSeconds=workingCuts.reduce((n,c)=>n+(c.endMs-c.startMs),0)/1000
        const score=rankCandidate({finderScore:candidate.finderScore,
          qaPass:disposition==='publish',issues:combinedIssues.length,
          durationSeconds,targetS:ctx.config.targetLengthS[1]})
        if(disposition==='drop'){
          out.suppressed=true
          out.notes.push((qaComplete?'Held as editable draft; critical editorial failure: ':'Held as editable draft; editorial QA did not complete: ')+combinedIssues.join('; ').slice(0,420))
          heldDrafts.push({out,candidate,score,durationSeconds,issues:combinedIssues,critical:true})
          continue
        }
        if(disposition==='publish_needs_review'){
          out.needsReview=true
          out.notes.push('Published with needsReview: '+combinedIssues.join('; ').slice(0,420))
        }
        out.editorialHandoff.review={pass:disposition==='publish',issues:combinedIssues}
        successful.push({out,candidate,score,durationSeconds})
      }catch(error){
        out.notes.push('Candidate failed: '+String((error as Error).message).slice(0,350))
        if(out.clipId)await discardClip(ctx.workspaceId,out.clipId)
        out.projectId=undefined;out.clipId=undefined
        await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'plan',
          tool:'clip_candidate_failed',kind:'validate',
          argsSummary:JSON.stringify({candidate:candidate.index,sourceRange:[candidate.startMs,candidate.endMs]}),
          error:String((error as Error).message).slice(0,700)})
      }finally{
        budget.addGemini(clipBudget.geminiUsd)
        budget.addLuna({prompt_tokens:clipBudget.lunaIn,completion_tokens:clipBudget.lunaOut})
      }
    }
    const ranked=[...successful].sort((a,b)=>b.score-a.score)
    const kept:typeof ranked=[]
    for(const item of ranked){
      const cuts=item.out.editorialHandoff!.cutPlan
      if(kept.some(k=>overlapFraction(cuts,k.out.editorialHandoff!.cutPlan)>.35)){
        await discardClip(ctx.workspaceId,item.out.clipId!)
        item.out.notes.push('Dropped: ranked candidate overlap >35%')
        item.out.projectId=undefined;item.out.clipId=undefined
        continue
      }
      kept.push(item)
    }
    // A run never publishes a critical draft. If nothing kept is publishable,
    // fall back to the best 1–3 non-critical held drafts (needsReview). If
    // only critical drafts remain, the run ends as an honest failure below.
    if(!kept.length){
      const usable=heldDrafts
        .filter(item=>Boolean(item.out.projectId&&item.out.clipId&&item.out.editorialHandoff?.cutPlan.length)&&!item.critical)
        .sort((a,b)=>b.score-a.score)
      const fallback=chooseFallbackPublications(usable,0,3,(item:{critical:boolean})=>item.critical)
      for(const item of fallback){
        const cuts=item.out.editorialHandoff!.cutPlan
        if(kept.some(k=>overlapFraction(cuts,k.out.editorialHandoff!.cutPlan)>.35))continue
        item.out.suppressed=false
        item.out.needsReview=true
        const reasons=item.issues
        item.out.editorialHandoff!.review={pass:false,issues:reasons}
        item.out.notes.push('Published as fallback needsReview so the run does not ship 0 clips: '+reasons.join('; ').slice(0,420))
        kept.push({out:item.out,candidate:item.candidate,score:item.score,durationSeconds:item.durationSeconds})
      }
    }
    for(const item of kept){
      const publishedCuts=item.out.editorialHandoff!.cutPlan
      const why=whyThisClip({
        logline:item.out.editorialHandoff?.outline.logline,
        label:item.candidate.label,
        instruction:run.instruction,
        durationSeconds:item.durationSeconds,
        targetS:ctx.config.targetLengthS[1],
        distinctMoments:storyCoverage(publishedCuts,ctx.config.targetLengthS[1]).distinctMoments,
      })
      const reviewIssues=item.out.editorialHandoff?.review?.issues??[]
      await publishClipScore({workspaceId:ctx.workspaceId,clipId:item.out.clipId!,
        runId,score:item.score,finderScore:item.candidate.finderScore,
        qaPass:item.out.editorialHandoff?.review?.pass??null,
        issues:reviewIssues,
        candidateIndex:item.candidate.index,durationSeconds:item.durationSeconds,
        mode:ctx.config.storyMode!,
        whyThisClip:why,
        stitchSegments:publishedCuts.map(c=>({startMs:c.startMs,endMs:c.endMs})),
        contextBridges:item.out.contextBridges??[],
        topics:topicQueryFromInstruction(run.instruction)?[topicQueryFromInstruction(run.instruction)]:undefined,
        needsReview:item.out.needsReview===true,
      })
      // Post-edit Motion is a decision stage, not the caption preset. It can
      // generate zero graphics; failures leave the usable clip intact.
      // needsReview clips get no auto Motion until the user reviews them.
      if(!shouldAutoPlanClipMotion({clipId:item.out.clipId,suppressed:item.out.suppressed,
        needsReview:item.out.needsReview===true})){
        item.out.notes.push('Motion graphics skipped: clip needs review')
      }else try{
        const {autoPlanClipMotion}=await import('@/lib/server/ai-producer-agent/clip-mode-motion')
        const bridges=item.out.contextBridges??[]
        const motion=await autoPlanClipMotion({
          workspaceId:ctx.workspaceId,clipId:item.out.clipId!,mode,
          instruction:[run.instruction??'',
            'If the opening is a complete claim, prefer one short source-grounded hook title in the first 3 seconds, inside the 9:16 safe area, clear of the speaker face and captions.',
            bridges.length?('Add a brief source-grounded context-bridge title card at these joins, using only these exact phrases: '+bridges.map(b=>b.text).join(' | ')): '',
          ].filter(Boolean).join(' '),
        })
        await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'apply',
          tool:'clip_motion_graphics_'+motion.status,kind:'system',
          argsSummary:JSON.stringify({clipId:item.out.clipId,candidate:item.candidate.index}),
          resultSummary:JSON.stringify(motion)})
        item.out.notes.push('Motion graphics: '+motion.status+' ('+motion.count+')')
      }catch(error){
        const reason=String((error as Error)?.message??error).slice(0,220)
        await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'apply',
          tool:'clip_motion_graphics_failed',kind:'validate',
          argsSummary:JSON.stringify({clipId:item.out.clipId,candidate:item.candidate.index}),
          error:reason})
        item.out.notes.push('Motion graphics unavailable: '+reason)
      }
      // Auto-export clean clips only; needsReview and critical clips wait
      // for the user to review and export manually.
      if(ctx.config.exportOnFinish)
        await queueClipExport(ctx,item.out,budget)
    }
    await logAiProducerStep({runId,stepIndex:++budget.steps,phase:'finish',
      tool:'clip_ranked_outputs',kind:'system',
      resultSummary:JSON.stringify({found:candidates.length,completed:successful.length,
        published:kept.length,scores:kept.map(k=>({clipId:k.out.clipId,score:k.score}))}).slice(0,4000)})
    // Each candidate uses a separate budget; do not cap all outputs together.
    if (budget.cappedBy) status = 'capped'
    const anyClip=outputs.some((o)=>Boolean(o.projectId&&o.clipId))
    const anyPublished=outputs.some((o)=>Boolean(o.projectId&&o.clipId)&&!o.suppressed)
    if (!anyClip) {
      status = 'failed'
      error = 'no valid plan for any output'
    } else if (!anyPublished) {
      const reasons=heldDrafts.flatMap(h=>h.issues)
      status = 'failed'
      error = ('No publishable clips; remaining drafts are critical editorial failures'
        +(reasons.length?': '+[...new Set(reasons)].join('; ').slice(0,1500):'.'))
    }
  } catch (err) {
    status = 'failed'
    error = String((err as Error)?.message ?? err).slice(0, 2000)
  } finally {
    await finishRun(ctx, outputs, budget, status, error)
  }
}

async function runOneOutput(ctx: ToolCtx, out: OutputState, budget: Budget,
  instruction: string | null, fullSourceWords: ClipWord[] = ctx.cache.words??[]) {
  if (ctx.config.editMode === 'just_chatting_rough_cut') {
    out.editorialHandoff = await createEditorialHandoff(ctx, out, budget, instruction)
  }
  if (out.editorialHandoff?.cutPlan.length) {
    const repaired=repairClipBoundaries(out.editorialHandoff.cutPlan,fullSourceWords,{
      maxEarlierSetupMs:12_000,maxLaterConclusionMs:6_500})
    if(repaired.repaired){
      out.editorialHandoff.cutPlan=repaired.cuts
      out.notes.push(...repaired.notes.slice(0,6).map(n=>'Editorial repair: '+n))
    }
    const honored=honorTargetDuration(out.editorialHandoff.cutPlan,fullSourceWords,ctx.config.targetLengthS[1])
    if(honored.note)out.notes.push(honored.note)
    if(honored.tightened)out.editorialHandoff.cutPlan=honored.cuts
    out.contextBridges=repaired.contextBridges
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
    const qaArgs={
      outline: out.editorialHandoff.outline,
      storyFinisher: out.editorialHandoff.finisher ?? null,
      highlightsFinisher: out.editorialHandoff.highlightsFinisher ?? null,
      selections: out.editorialHandoff.cutPlan,
      fullTranscriptWordIndexed:true,
      fullTranscriptFormat:'[originalWordId,sourceStartMs,sourceEndMs,spokenWord] — COMPLETE authorized source',
      fullTranscript:completeTranscriptWords(
        qaTranscriptWindow(fullSourceWords,out.editorialHandoff.cutPlan,ctx.sources[0]!.rangeMs!),
        true),
      flaggedContextAndQualificationRisks:clipEditorialAudit(out.editorialHandoff.cutPlan,fullSourceWords,{storyPlan:storyPlanFromHandoff(out.editorialHandoff)}),
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
      instruction: [clipEditorialInstructions(),ctx.config.roughCutIntent === 'highlights'
        ? 'HIGHLIGHTS QA: Inspect actual opening and closing transcript words for EVERY selected moment and all joins. Use the Highlights Finisher verified landings: confirm every promised quote remains in the final footage and each highlight actually ends naturally. Check that no unrelated talk after a landing, incomplete opening, missing independent payoff, or overlong segment remains. Require distinct source moments, not breath cuts. If source words do not support the finishing choices, pass=false with precise timestamps. No rendered audio was supplied; acoustic joins require listening review.'
        : 'EDITORIAL BASELINE (NO LENGTH TARGET): Judge whether one specific story is coherently told from a clear opening through its recorded ending. Inspect the first words for missing setup and the NEXT 6.5 seconds of ORIGINAL source after each end for a meaning-changing qualifier, negation, exception or conclusion. Check that every stitched passage makes sense with only earlier OUTPUT passages. If a meaning-changing qualifier is omitted, pass=false with source-word evidence and an exact repair hint. A short complete 15-second edit is valid; never penalize length or number of passages. Verify titles/caption proper-name spelling against evidence; do not pretend ASR guarantees spelling. Do not infer audio quality without listening.'].join(' '),
    }
    const runQa=async(qaBudget:Budget)=>{
      try{
        const review=await runEditorialRole(ctx,out,qaBudget,'qa',qaArgs)
        return {complete:true as const,pass:review.pass===true,issues:review.issues as string[]}
      }catch(error){
        const message=String((error as Error)?.message??error)
        return {complete:false as const,pass:false,issues:['Editorial QA could not complete: '+message.slice(0,250)],error:message}
      }
    }
    let review=await runQa(budget)
    if(!review.complete&&(/specialist_budget_exhausted/i.test(review.error??'')||budget.state()==='hard')){
      const qaBudget=new Budget({
        wallClockMs:clipQaRetryWallClockMs(),
        hardSteps:clipQaRetryHardSteps(),
        softSteps:20,
      })
      out.notes.push('Retrying editorial QA with a reserved budget after the candidate budget was exhausted')
      review=await runQa(qaBudget)
      budget.addGemini(qaBudget.geminiUsd)
      budget.addLuna({prompt_tokens:qaBudget.lunaIn,completion_tokens:qaBudget.lunaOut})
    }
    out.editorialHandoff.review={pass:review.complete&&review.pass,issues:review.issues}
    out.notes.push(...out.editorialHandoff.review.issues.slice(0,10).map((issue)=>'Editorial QA: '+issue))
    if(!review.complete){
      out.notes.push('Editorial QA did not complete; holding this clip as a draft')
    }else if(!out.editorialHandoff.review.pass){
      // QA findings belong on the editable draft. Do not discard an otherwise
      // valid rough cut solely because the editorial review asks for revisions.
      out.notes.push('Editorial QA requested revisions; editable rough cut retained')
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

async function persistRevisedCuts(ctx:ToolCtx,out:OutputState,cuts:Array<{startMs:number;endMs:number;kind?:string}>){
  const builder=out.builder
  if(!builder||!cuts.length)return
  const sourceId=builder.mainSourceId
  builder.preserveApprovedEdges=true
  builder.segs.splice(0,builder.segs.length)
  for(const cut of cuts){
    builder.addSegment({sourceId,srcInMs:cut.startMs,srcOutMs:cut.endMs})
  }
  if(cuts.length>1){
    const joins=stitchJoinTransitions(cuts)
    for(let i=1;i<builder.segs.length;i++){
      const seg=builder.segs[i]
      const join=joins[i-1]
      if(seg&&join){
        try{builder.setTransition(seg.id,'dissolve',join.durMs)}
        catch{/* transition is optional smoothing */}
      }
    }
  }
  out.lastValid=builder.snapshot()
  if(out.lastValid.transitions?.length){
    const starts=new Set(cuts.slice(1).map(c=>c.startMs))
    out.lastValid={...out.lastValid,transitions:out.lastValid.transitions.filter((tr:{srcMs:number})=>starts.has(tr.srcMs))}
  }
  if(out.clipId)await ctx.writeDraft(out,out.lastValid)
}

async function queueClipExport(ctx:ToolCtx,out:OutputState,budget:Budget){
  const clipMode=ctx.config.storyMode==='clip_moment_v1'||ctx.config.storyMode==='clip_story_v1'
  if(!clipMode||!out.lastValid)return
  if(!shouldAutoExportPublishedClip({
    clipId:out.clipId,projectId:out.projectId,suppressed:out.suppressed,
    needsReview:out.needsReview===true,
  })){
    if(out.needsReview===true)out.notes.push('Finished MP4 export skipped: clip needs review')
    return
  }
  const prisma=getPrisma()
  const result=await queueClipExportOnce({
    workspaceId:ctx.workspaceId,
    projectId:out.projectId,
    clipId:out.clipId,
    filename:(out.editorialHandoff?.outline.logline??'AI clip').replace(/[\\/:*?"<>|]/g,'').slice(0,80)+'.mp4',
    editVersion:editVersionFromSnapshot(out.lastValid),
    preset:CLIP_AGENT_EXPORT_PRESET,
    suppressed:out.suppressed,
    needsReview:out.needsReview===true,
    createId,
    store:{
      findByIdempotencyKey:async(key:string)=>{
        const row=await prisma.clipRender.findFirst({
          where:{clipId:out.clipId!,editsVersionHash:key,preset:CLIP_AGENT_EXPORT_PRESET},
          select:{id:true,status:true},
        })
        return row
      },
      // Atomic: the unique index clip_renders(clipId, editsVersionHash, preset)
      // rejects a concurrent duplicate; the render + job insert roll back
      // together and we return the existing export instead.
      createQueuedExport:async(input)=>{
        try{
          await prisma.$transaction(async tx=>{
            await tx.clipRender.create({data:{
              id:input.renderId,clipId:input.clipId,workspaceId:input.workspaceId,
              status:'QUEUED',format:'mp4',resolution:'720p',aspectRatio:'9:16',
              filename:input.filename,watermark:false,
              editsVersionHash:input.idempotencyKey,preset:input.preset,
            }})
            await tx.clipJob.create({data:{
              id:createId('job'),projectId:input.projectId,clipId:input.clipId,
              type:'RENDER_CLIP',status:'QUEUED',
              payload:{renderId:input.renderId,idempotencyKey:input.idempotencyKey},
            }})
          })
          return {created:true as const}
        }catch(error){
          if(!isUniqueConflict(error))throw error
          const existing=await prisma.clipRender.findFirst({
            where:{clipId:input.clipId,editsVersionHash:input.idempotencyKey,preset:input.preset},
            select:{id:true,status:true},
          })
          if(!existing)throw error
          return {created:false as const,existing}
        }
      },
    },
  })
  if(!result.queued&&result.reason==='already_queued'){
    out.notes.push('Finished MP4 export already queued: '+result.renderId)
    return
  }
  if(!result.queued)return
  out.notes.push('Finished MP4 export queued: '+result.renderId)
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'apply',tool:'clip_agent_export_queued',kind:'system',
    resultSummary:JSON.stringify({renderId:result.renderId,projectId:out.projectId,clipId:out.clipId,idempotencyKey:result.idempotencyKey})})
}

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
  const clipMode=ctx.config.storyMode==='clip_moment_v1'||ctx.config.storyMode==='clip_story_v1'
  const title=clipMode
    ? `AI ${ctx.config.storyMode==='clip_moment_v1'?'moment':'story'} clip · ${source.title??'video'}`
    : `AI Producer ${ctx.config.roughCutIntent === 'highlights' ? 'highlights' : 'rough cut'} · ${source.title ?? 'stream'}`
  const created = await sysTool(ctx, budget, 'plan', 'create_project', {
    title, sources: [source.sourceId], aspect: clipMode?'9:16':'16:9', outputType: out.outputType,
  }, out)
  if (!created.ok || !out.builder) throw new Error('rough_cut_builder_creation_failed: ' + created.summary)
  // The shared edit tool defaults rough-cut Producer to 16:9.
  // Override only this isolated clip-mode builder before validation/persistence.
  out.builder.aspectRatio='9:16'
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
  if (clipMode && cuts.length>1 && out.builder) {
    const joins=stitchJoinTransitions(cuts)
    let outAt=0
    for (let i=0;i<cuts.length;i++) {
      const seg=out.builder.segs[i]
      const dur=cuts[i]!.endMs-cuts[i]!.startMs
      if(i>0&&seg){
        const join=joins[i-1]
        if(join) out.builder.setTransition(seg.id,'dissolve',join.durMs)
        // Alternate a modest punch-in so framing changes at a jump cut feel intended.
        if(i%2===1&&dur>1800){
          try{out.builder.addZoom(outAt,outAt+Math.min(900,dur-500),1.08,'smooth')}
          catch(_zoomErr){/* zoom is optional smoothing; never fail assembly */}
        }
      }
      outAt+=dur
    }
    if(joins.length){
      out.notes.push('Smoothed '+joins.length+' stitch joins with brief crossfades')
      await logAiProducerStep({
        runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
        tool:'clip_stitch_join_smoothing',kind:'system',
        resultSummary:JSON.stringify({joins:joins.length,transitions:joins}),
      })
    }
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
  const published = outputs.filter((o) => Boolean(o.projectId&&o.clipId)&&!o.suppressed)
  const projectIds = [...new Set(published.map((o) => o.projectId!))]
  const clipIds = published.map((o) => o.clipId!)
  const first = published[0]
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
        publishedClipCount: clipIds.length,
        publishedClipIds: clipIds,
        sourceProjectIds: projectIds,
        // outputProjectIds is a legacy project list (one uploaded project),
        // not the number of generated clips. Keep every clip ID explicitly.
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
