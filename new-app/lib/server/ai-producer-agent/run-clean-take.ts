import 'server-only'

import {createId} from '@/lib/supabase/id'
import {getPrisma} from '@/lib/server/db'
import {loadRoughCutWords} from '@/lib/server/ai-producer-agent/rough-cut-source'
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
  const result=await planCleanTake(inputs,instruction??undefined,usage=>{
    budget.steps++
    budget.addLuna(usage)
  },async event=>{
    await logAiProducerStep({
      runId:ctx.runId,stepIndex:++budget.steps,
      phase:event.stage==='review'?'validate':'plan',
      tool:'clean_take_'+event.stage+'_'+event.status,
      kind:event.status==='rejected'?'validate':'luna',
      resultSummary:JSON.stringify(event).slice(0,4000),
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
