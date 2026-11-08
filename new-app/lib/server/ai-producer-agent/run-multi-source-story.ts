import 'server-only'

import { createId } from '@/lib/supabase/id'
import { getPrisma } from '@/lib/server/db'
import { loadRoughCutWords } from '@/lib/server/ai-producer-agent/rough-cut-source'
import { createMultiSourceStoryOutput } from '@/lib/server/ai-producer-agent/create-multi-source-output'
import { enqueueAiProducerAnalyzeJob,waitForClipJobDone } from '@/lib/server/ai-producer-agent/enqueue-analyze'
import { planMultiSourceStory,validateMultiStorySources,type MultiStorySource } from '@/lib/ai-producer-agent/multi-source-story'
import { timestampedAsrForVisual,visualMomentsWithAsr,chooseVisualFocusWindows } from '@/lib/ai-producer-agent/visual-evidence'
import { logAiProducerStep } from '@/lib/ai-producer-agent/log'
import type { ToolCtx } from '@/lib/ai-producer-agent/tools/registry'
import type { OutputState } from '@/lib/ai-producer-agent/orchestrator'
import type { Budget } from '@/lib/ai-producer-agent/budget'

/** Independent multi-source workflow. Never calls the existing single-source
 * specialists or DraftEditsBuilder. The result is a real E5b-enabled edit
 * project with source-audio inserts and can be exported by the same worker. */
export async function runMultiSourceStoryOutput(
  ctx:ToolCtx,out:OutputState,budget:Budget,instruction:string|null,
):Promise<void>{
  if(ctx.sources.length<2||ctx.sources.length>5)
    throw Error('multisource_requires_2_to_5_sources')
  const inputs:MultiStorySource[]=[]
  for(const source of ctx.sources){
    if(!source.projectId||!source.rangeMs)throw Error('multisource_source_requires_project')
    const words=await loadRoughCutWords(ctx.workspaceId,source,0)
    inputs.push({source,words})
  }
  validateMultiStorySources(inputs)
  for(const input of inputs){
    if(!budget.canSpendGemini(0.06)){
      out.notes.push('Visual analysis skipped for '+input.source.sourceId+' (budget)')
      continue
    }
    const source=input.source
    const started=Date.now()
    try{
      const job=await enqueueAiProducerAnalyzeJob({
        runId:ctx.runId,projectId:source.projectId!,mode:'best_moments',
        sources:[source],targetClipLenS:60,
        visualEvidence:{enabled:true,model:'gemini-3.1-flash-lite',
          transcriptText:timestampedAsrForVisual(input.words,source.rangeMs!)},
      })
      const done=await waitForClipJobDone(job.id)
      const result=(done.payload as {analyzeResult?:{
        moments?:Record<string,unknown>[];meta?:Record<string,unknown>}}|null)?.analyzeResult
      if(!result)throw Error('multisource_visual_analysis_missing')
      input.visualObservations=visualMomentsWithAsr(
        result.moments,input.words,source.rangeMs!,'coarse_1fps',35,
      ).map(m=>({startMs:m.sourceRangeMs[0],endMs:m.sourceRangeMs[1],
        observation:m.observation,whyInteresting:m.whyInteresting,
        spokenContext:m.spokenContext,category:m.category,analysisTier:m.analysisTier}))
      const cost=Number(result.meta?.est_usd??0)
      if(Number.isFinite(cost)&&cost>=0)budget.addGemini(cost)
      await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
        phase:'ingest',tool:'multisource_visual_inventory',kind:'validate',
        argsSummary:JSON.stringify({sourceId:source.sourceId,rangeMs:source.rangeMs}),
        resultSummary:JSON.stringify({observations:input.visualObservations.length,
          sourceId:source.sourceId}),durationMs:Date.now()-started,
        estUsd:Number.isFinite(cost)?cost:undefined})
      // Same second-pass Gemini video + ORIGINAL audio + source-aligned ASR
      // used by single-source visual_audio. Keep the source identity local;
      // an observation from one interview must never be attributed to another.
      const windows=chooseVisualFocusWindows(result.moments,source.rangeMs!,3)
      if(windows.length && budget.canSpendGemini(0.50)){
        try {
          const focusJob=await enqueueAiProducerAnalyzeJob({
            runId:ctx.runId,projectId:source.projectId!,mode:'visual_detail',
            sources:[source],targetClipLenS:45,
            visualEvidence:{
              enabled:true,model:'gemini-3.1-flash-lite',
              focusWindows:windows.map(([startMs,endMs])=>({
                startMs,endMs,
                transcriptText:timestampedAsrForVisual(input.words,[startMs,endMs],12_000),
              })),
            },
          })
          const focusedDone=await waitForClipJobDone(focusJob.id)
          const focusedResult=(focusedDone.payload as {analyzeResult?:{
            moments?:Record<string,unknown>[];meta?:Record<string,unknown>
          }}|null)?.analyzeResult
          if(!focusedResult)throw Error('multisource_visual_focus_missing')
          const focused=visualMomentsWithAsr(
            focusedResult.moments,input.words,source.rangeMs!,'focused_1fps',24,
          )
          input.visualObservations.push(...focused.map(m=>({
            startMs:m.sourceRangeMs[0],endMs:m.sourceRangeMs[1],
            observation:m.observation,whyInteresting:m.whyInteresting,
            spokenContext:m.spokenContext,category:m.category,
            analysisTier:m.analysisTier,
          })))
          const focusedCost=Number(focusedResult.meta?.est_usd??0)
          if(Number.isFinite(focusedCost)&&focusedCost>=0)budget.addGemini(focusedCost)
          await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
            phase:'ingest',tool:'multisource_visual_focus_ready',kind:'validate',
            argsSummary:JSON.stringify({sourceId:source.sourceId,windows,
              originalAudioAttached:focusedResult.meta?.original_audio_attached,
              focusWindowResults:focusedResult.meta?.focus_window_results??[]}),
            resultSummary:JSON.stringify({focusedObservations:focused.length,
              coarseObservations:input.visualObservations.length-focused.length}),
            estUsd:Number.isFinite(focusedCost)?focusedCost:undefined})
        }catch(focusError){
          // Detailed video review is additive. Preserve the coarse evidence.
          await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
            phase:'ingest',tool:'multisource_visual_focus_unavailable',kind:'validate',
            argsSummary:JSON.stringify({sourceId:source.sourceId,windows}),
            error:String((focusError as Error).message).slice(0,250)})
        }
      }else{
        await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
          phase:'ingest',tool:'multisource_visual_focus_skipped',kind:'validate',
          argsSummary:JSON.stringify({sourceId:source.sourceId,windowCount:windows.length}),
          resultSummary:windows.length?'Gemini budget insufficient':'No focus candidates'})
      }
    }catch(err){
      // A failed Gemini pass cannot make real source speech invalid. Preserve
      // the failure as evidence so Story can be audited against transcript-only.
      out.notes.push('Visual analysis unavailable for '+source.sourceId+': '+
        String((err as Error).message).slice(0,150))
      await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
        phase:'ingest',tool:'multisource_visual_unavailable',kind:'validate',
        argsSummary:JSON.stringify({sourceId:source.sourceId}),
        error:String((err as Error).message).slice(0,200)})
    }
  }
  let plan=await planMultiSourceStory(inputs,instruction??undefined,usage=>{
    budget.steps++
    budget.addLuna(usage)
  },async event=>{
    // Durable per-attempt diagnostics. Never log raw transcripts, video
    // URLs, model prompt bodies or full tool-call arguments.
    const {stage,attempt,status,errorCode,errorDetail,
      tokensIn,tokensOut,durationMs,...details}=event
    const diagnostic={
      stage,attempt,status,errorCode:errorCode??null,
      errorDetail:errorDetail??null,...details,
    }
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,phase:'plan',
      tool:'multisource_'+stage+'_'+status,
      kind:status==='rejected'||status==='exhausted'?'validate':'luna',
      argsSummary:JSON.stringify({stage,attempt,...details}).slice(0,4000),
      resultSummary:JSON.stringify({status,errorCode}).slice(0,4000),
      error:status==='rejected'||status==='exhausted'
        ? (errorDetail??errorCode??'multisource_submission_invalid'):undefined,
      durationMs,tokensIn,tokensOut,
    })
    if(status==='rejected'||status==='exhausted')
      console.warn('[ai-producer:multisource:submission]',JSON.stringify(diagnostic))
  })
  const sourceDurations=inputs.map(input=>({
    sourceId:input.source.sourceId,
    availableWords:input.words.length,
    selectedMs:plan.cuts.filter(c=>c.sourceId===input.source.sourceId)
      .reduce((n,c)=>n+c.endMs-c.startMs,0),
    passageCount:plan.cuts.filter(c=>c.sourceId===input.source.sourceId).length,
  }))
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'validate',tool:'multisource_source_coverage',kind:'validate',
    resultSummary:JSON.stringify({sources:sourceDurations,
      note:'Descriptive only; no equal-time or minimum-source quota.'})})
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'plan',tool:'multisource_story_footage_flow_handoff',kind:'validate',
    argsSummary:JSON.stringify({
      outline:plan.outline,
      cuts:plan.cuts,
    }).slice(0,12000),
    resultSummary:JSON.stringify({sourcesUsed:[...new Set(plan.cuts.map(c=>c.sourceId))],
      cuts:plan.cuts.length,estimatedDurationMs:plan.estimatedDurationMs})})
  // Independent editorial QA happens before the render, but cannot silently
  // replace or destroy a source-grounded edit. Surface problems for Grok review.
  try {
    const { reviewMultiSourceStory }=await import('@/lib/ai-producer-agent/multi-source-qa')
    const review=await reviewMultiSourceStory(plan,inputs,usage=>{
      budget.steps++
      budget.addLuna(usage)
    })
    await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
      phase:'validate',tool:'multisource_editorial_qa',kind:'validate',
      resultSummary:JSON.stringify(review).slice(0,12000)})
    if(!review.pass && review.issues.length){
      // One bounded revision pass; preserve the already-valid plan on errors
      // or if a second independent review does not improve the issue count.
      const {reviseMultiSourceStoryFromQa}=await import('@/lib/ai-producer-agent/multi-source-qa')
      if(budget.state()!=='hard'){
        const revision=await reviseMultiSourceStoryFromQa(plan,inputs,review.issues,usage=>{
          budget.steps++
          budget.addLuna(usage)
        })
        await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
          phase:'validate',tool:'multisource_qa_revision_proposal',kind:'validate',
          resultSummary:JSON.stringify({applied:revision.applied,
            reason:revision.reason,removed:revision.removed,repaired:revision.repaired,
            skippedCorrections:revision.skippedCorrections??[],
            originalCuts:plan.cuts.length,revisedCuts:revision.plan.cuts.length})})
        if(revision.applied){
          const revisedReview=await reviewMultiSourceStory(revision.plan,inputs,usage=>{
            budget.steps++
            budget.addLuna(usage)
          })
          const improved=revisedReview.issues.length<review.issues.length||
            (revisedReview.pass&&!review.pass)
          await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
            phase:'validate',tool:'multisource_qa_revision_decision',kind:'validate',
            resultSummary:JSON.stringify({accepted:improved,
              beforeIssues:review.issues.length,afterIssues:revisedReview.issues.length,
              afterPass:revisedReview.pass})})
          if(improved){
            plan=revision.plan
            out.notes.push('Editorial QA revision improved paper edit: '+
              review.issues.length+' to '+revisedReview.issues.length+' concerns.')
            review.issues=revisedReview.issues
          }
        }
      }
      out.notes.push(...review.issues.slice(0,10).map(issue=>'Editorial QA: '+issue))
    }
  }catch(error){
    out.notes.push('Multi-source editorial QA unavailable: '+
      String((error as Error).message).slice(0,180))
    await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
      phase:'validate',tool:'multisource_editorial_qa_unavailable',kind:'validate',
      error:String((error as Error).message).slice(0,250)})
  }
  const created=await createMultiSourceStoryOutput({
    workspaceId:ctx.workspaceId,createdById:ctx.createdById,
    runId:ctx.runId,inputs,plan,
  })
  out.projectId=created.projectId
  out.clipId=created.clipId
  out.story=plan.outline.logline
  out.notes.push('Multi-source narrative: '+plan.cuts.length+' source-tagged passages; '+
    new Set(plan.cuts.map(c=>c.sourceId)).size+' recordings used; '+
    (created.durationMs/1000).toFixed(1)+'s')
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'apply',tool:'multisource_finished_edit_created',kind:'system',
    resultSummary:JSON.stringify(created)})
  if(ctx.config.exportOnFinish){
    const prisma=getPrisma()
    const renderId=createId('render')
    await prisma.$transaction(async tx=>{
      await tx.clipRender.create({
        data:{id:renderId,clipId:created.clipId,workspaceId:ctx.workspaceId,
          status:'QUEUED',format:'mp4',resolution:'720p',aspectRatio:'16:9',
          filename:plan.outline.title+'.mp4',watermark:false},
      })
      await tx.clipJob.create({
        data:{id:createId('job'),projectId:created.projectId,clipId:created.clipId,
          type:'RENDER_CLIP',status:'QUEUED',payload:{renderId}},
      })
    })
    out.notes.push('Finished MP4 export queued: '+renderId)
    await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
      phase:'apply',tool:'multisource_export_queued',kind:'system',
      resultSummary:JSON.stringify({renderId,projectId:created.projectId,
        clipId:created.clipId})})
  }
}
