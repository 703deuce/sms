import 'server-only'

import {createId} from '@/lib/supabase/id'
import {getPrisma} from '@/lib/server/db'
import {loadRoughCutWords} from '@/lib/server/ai-producer-agent/rough-cut-source'
import {enqueueAiProducerAnalyzeJob,waitForClipJobDone} from '@/lib/server/ai-producer-agent/enqueue-analyze'
import {timestampedAsrForVisual,visualMomentsWithAsr,chooseVisualFocusWindows} from '@/lib/ai-producer-agent/visual-evidence'
import {createMultiSourceStoryOutput} from '@/lib/server/ai-producer-agent/create-multi-source-output'
import {planCleanTake,type CleanTakeSource} from '@/lib/ai-producer-agent/clean-take'
import {logAiProducerStep} from '@/lib/ai-producer-agent/log'
import type {ToolCtx} from '@/lib/ai-producer-agent/tools/registry'
import type {OutputState} from '@/lib/ai-producer-agent/orchestrator'
import type {Budget} from '@/lib/ai-producer-agent/budget'

/** Independent Clean Take operation. Legacy single-source Story/rough-cut
 * and multi-source documentary paths are not entered or mutated. */
export async function runCleanTakeOutput(
  ctx:ToolCtx,out:OutputState,budget:Budget,instruction:string|null,
):Promise<void>{
  if(ctx.sources.length<1||ctx.sources.length>5)
    throw Error('clean_take_requires_1_to_5_recordings')
  const inputs:CleanTakeSource[]=[]
  for(const source of ctx.sources){
    if(!source.projectId||!source.rangeMs)
      throw Error('clean_take_source_requires_upload_project')
    inputs.push({source,words:await loadRoughCutWords(ctx.workspaceId,source,1)})
  }
  // Share the original visual+audio+ASR analysis contracts used by the
  // existing rough cut and multi-source modes. Never substitute a plain
  // transcript when a user explicitly selected multimodal Clean Take.
  for(const input of inputs){
    const source=input.source
    if(!budget.canSpendGemini(0.06))
      throw Error('clean_take_multimodal_budget_unavailable')
    const job=await enqueueAiProducerAnalyzeJob({
      runId:ctx.runId,projectId:source.projectId!,mode:'best_moments',
      sources:[source],targetClipLenS:60,
      visualEvidence:{enabled:true,model:'gemini-3.1-flash-lite',
        transcriptText:timestampedAsrForVisual(input.words,source.rangeMs!)},
    })
    const completed=await waitForClipJobDone(job.id)
    const analysis=(completed.payload as {analyzeResult?:{
      moments?:Record<string,unknown>[];meta?:Record<string,unknown>
    }}|null)?.analyzeResult
    if(!analysis)throw Error('clean_take_multimodal_analysis_unavailable')
    const coarse=visualMomentsWithAsr(
      analysis.moments,input.words,source.rangeMs!,'coarse_3s',50)
    const attached=analysis.meta?.original_audio_attached===true
    if(!attached||coarse.length===0)
      throw Error('clean_take_video_original_audio_observations_missing')
    const cost=Number(analysis.meta?.est_usd??0)
    if(Number.isFinite(cost)&&cost>=0)budget.addGemini(cost)
    input.visualObservations=coarse.map(m=>({
      startMs:m.sourceRangeMs[0],endMs:m.sourceRangeMs[1],
      observation:m.observation,whyInteresting:m.whyInteresting,
      spokenContext:m.spokenContext,category:m.category,analysisTier:m.analysisTier,
    }))
    input.visualEvidence={
      originalAudioAttached:true,asrTranscriptAttached:true,
      coarseCount:coarse.length,focusedCount:0,
    }
    await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
      phase:'ingest',tool:'clean_take_visual_audio_inventory',kind:'validate',
      argsSummary:JSON.stringify({sourceId:source.sourceId,rangeMs:source.rangeMs,
        model:'gemini-3.1-flash-lite',originalAudioAttached:attached,
        asrTranscriptAttached:true}),
      resultSummary:JSON.stringify({sourceId:source.sourceId,
        coarseObservations:coarse.length,sourceWords:input.words.length}),
      estUsd:Number.isFinite(cost)&&cost>=0?cost:undefined})
    // Focus on potentially important performances/retakes. A focused pass
    // is additive to the coarse evidence; it never changes source word IDs.
    const windows=chooseVisualFocusWindows(analysis.moments,source.rangeMs!,3)
    if(windows.length&&budget.canSpendGemini(0.50)){
      try{
        const focusedJob=await enqueueAiProducerAnalyzeJob({
          runId:ctx.runId,projectId:source.projectId!,mode:'visual_detail',
          sources:[source],targetClipLenS:45,
          visualEvidence:{enabled:true,model:'gemini-3.1-flash-lite',
            focusWindows:windows.map(([startMs,endMs])=>({
              startMs,endMs,
              transcriptText:timestampedAsrForVisual(input.words,[startMs,endMs],12000),
            })),
          },
        })
        const completedFocus=await waitForClipJobDone(focusedJob.id)
        const focus=(completedFocus.payload as {analyzeResult?:{
          moments?:Record<string,unknown>[];meta?:Record<string,unknown>
        }}|null)?.analyzeResult
        if(!focus)throw Error('clean_take_visual_focus_missing')
        const details=visualMomentsWithAsr(
          focus.moments,input.words,source.rangeMs!,'focused_1fps',36)
        input.visualObservations.push(...details.map(m=>({
          startMs:m.sourceRangeMs[0],endMs:m.sourceRangeMs[1],
          observation:m.observation,whyInteresting:m.whyInteresting,
          spokenContext:m.spokenContext,category:m.category,analysisTier:m.analysisTier,
        })))
        input.visualEvidence.focusedCount=details.length
        const focusCost=Number(focus.meta?.est_usd??0)
        if(Number.isFinite(focusCost)&&focusCost>=0)budget.addGemini(focusCost)
        await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
          phase:'ingest',tool:'clean_take_focused_video_audio',kind:'validate',
          argsSummary:JSON.stringify({sourceId:source.sourceId,windows,
            originalAudioAttached:focus.meta?.original_audio_attached??false}),
          resultSummary:JSON.stringify({focusedObservations:details.length}),
          estUsd:Number.isFinite(focusCost)&&focusCost>=0?focusCost:undefined})
      }catch(error){
        out.notes.push('Clean Take detailed video analysis unavailable for '+
          source.sourceId+': '+String((error as Error).message).slice(0,150))
        await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
          phase:'ingest',tool:'clean_take_focused_video_audio_unavailable',kind:'validate',
          argsSummary:JSON.stringify({sourceId:source.sourceId,windows}),
          error:String((error as Error).message).slice(0,220)})
      }
    }else{
      await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
        phase:'ingest',tool:'clean_take_visual_focus_skipped',kind:'validate',
        argsSummary:JSON.stringify({sourceId:source.sourceId,windowCount:windows.length}),
        resultSummary:windows.length?'No Gemini budget':'No focus windows'})
    }
  }
  const result=await planCleanTake(inputs,instruction??undefined,usage=>{
    budget.steps++
    budget.addLuna(usage)
  },async event=>{
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,
      phase:event.stage==='review'?'validate':'plan',
      tool:'clean_take_'+event.stage+'_'+event.status,
      kind:event.status==='rejected'?'validate':'luna',
      argsSummary:event.proposalSummary?JSON.stringify({
        attempt:event.attempt,invalidSelectionIndex:event.invalidSelectionIndex,
        proposalSummary:event.proposalSummary,
      }).slice(0,12000):undefined,
      resultSummary:JSON.stringify({stage:event.stage,status:event.status,
        attempt:event.attempt,reason:event.reason,repairHint:event.repairHint,
        cuts:event.cuts,sourceSequence:event.sourceSequence}).slice(0,4000),
      error:event.status==='rejected'?event.reason:undefined,
    })
  })
  const {plan,review,droppedTakeReasons}=result
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'plan',tool:'clean_take_validated_edit',kind:'validate',
    argsSummary:JSON.stringify({outline:plan.outline,cuts:plan.cuts}).slice(0,12000),
    resultSummary:JSON.stringify({
      cuts:plan.cuts.length,estimatedDurationMs:plan.estimatedDurationMs,
      originalSourceDurationMs:inputs.reduce((total,x)=>
        total+(x.source.rangeMs![1]-x.source.rangeMs![0]),0),
      sourceSequence:plan.cuts.map(c=>c.sourceId),
      discardedTakeNotes:droppedTakeReasons.slice(0,12),
      editorialReview:review,
      multimediaEvidence:inputs.map(x=>({sourceId:x.source.sourceId,
        ...(x.visualEvidence??{}),totalObservations:x.visualObservations?.length??0})),
    }).slice(0,12000)})
  // Expose actionable QA as review notes. Do not silently replace safe
  // source-grounded words or fabricate missing speech on an unverified guess.
  if(!review.pass)out.notes.push(...review.issues.map(x=>'Clean Take QA: '+x))
  const created=await createMultiSourceStoryOutput({
    workspaceId:ctx.workspaceId,createdById:ctx.createdById,
    runId:ctx.runId,inputs,plan,
  })
  out.projectId=created.projectId
  out.clipId=created.clipId
  out.story=plan.outline.logline
  out.notes.push('Clean Take: '+plan.cuts.length+' real word-exact retained takes, '+
    (created.durationMs/1000).toFixed(1)+'s; source recordings '+
    new Set(plan.cuts.map(c=>c.sourceId)).size+'.')
  await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
    phase:'apply',tool:'clean_take_project_created',kind:'system',
    resultSummary:JSON.stringify(created)})
  if(ctx.config.exportOnFinish){
    const prisma=getPrisma(),renderId=createId('render')
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
    out.notes.push('Clean Take MP4 export queued: '+renderId)
    await logAiProducerStep({runId:ctx.runId,stepIndex:++budget.steps,
      phase:'apply',tool:'clean_take_export_queued',kind:'system',
      resultSummary:JSON.stringify({renderId,clipId:created.clipId})})
  }
}
