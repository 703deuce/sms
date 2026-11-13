import 'server-only'

import { getPrisma } from '@/lib/server/db'
import { ytLog, ytErrorCode } from '@/lib/youtube-video/pipeline/yt-audit'
import { ytFindMoments, ytReadMomentsJob } from '@/lib/youtube-video/pipeline/yt-find-moments'
import { ytRefineVisualStoryEvidence } from '@/lib/youtube-video/pipeline/yt-visual-refine'
import {
  ytCreateEditorialHandoff,ytSelectFootage,ytDialoguePictureReview,ytQualityReview,ytVisualSceneCovered,
} from '@/lib/youtube-video/pipeline/yt-editorial-handoff'
import {
  ytRunStoryFinisher,ytFinishWholeSourceStory,ytQaWholeSourceStory,
} from '@/lib/youtube-video/pipeline/yt-story-finisher'
import type {
  YtActiveWindow,YtCheckpoint,YtPlanArgs,YtProgress,YtSelectedCut,YtWindowContext,
} from '@/lib/youtube-video/pipeline/yt-types'
import type { YoutubeVideoOption } from '@/lib/youtube-video/types'

const YT_WINDOW_MS=20*60_000

function sourceKey(args:YtPlanArgs):string{
  return args.sources.map(s=>[s.sourceId,s.projectId,s.durationMs,s.words.length].join(':')).join('|')
}

/** Every usable source millisecond is assigned to a window. Small tail
 * fragments are merged into the previous one, never silently discarded. */
export function ytAllWindows(args:YtPlanArgs):Array<{
  sourceIndex:number;startMs:number;endMs:number
}>{
  const out:Array<{sourceIndex:number;startMs:number;endMs:number}>=[]
  args.sources.forEach((source,sourceIndex)=>{
    if(!Number.isSafeInteger(source.durationMs)||source.durationMs<1500)
      throw Error('yt_invalid_source_duration')
    for(let startMs=0;startMs<source.durationMs;startMs+=YT_WINDOW_MS){
      const endMs=Math.min(source.durationMs,startMs+YT_WINDOW_MS)
      const prior=out[out.length-1]
      if(endMs-startMs<15_000 && prior?.sourceIndex===sourceIndex){
        prior.endMs=endMs
      }else{
        out.push({sourceIndex,startMs,endMs})
      }
    }
  })
  return out
}

async function ytGetMediaKey(args:YtPlanArgs,sourceIndex:number,endMs:number):Promise<string>{
  const source=args.sources[sourceIndex]
  if(!source)throw Error('yt_source_missing')
  const project=await getPrisma().clipProject.findFirst({
    where:{id:source.projectId,workspaceId:args.workspaceId,deletedAt:null},
    select:{upload:{select:{key:true,status:true,durationMs:true}}},
  })
  if(!project?.upload || project.upload.status!=='COMPLETE' ||
    !project.upload.key || (project.upload.durationMs!=null &&
    endMs>project.upload.durationMs+1000)) throw Error('yt_media_unavailable')
  return project.upload.key
}

function makeWindowContext(args:YtPlanArgs,active:YtActiveWindow,windowIndex:number,windowCount:number):YtWindowContext{
  const source=args.sources[active.sourceIndex]!
  return {
    windowIndex,windowCount,
    sourceId:source.sourceId,startMs:active.startMs,endMs:active.endMs,
    words:source.words.filter(w=>w.e*1000>active.startMs &&
      w.s*1000<active.endMs).map(w=>({w:w.w,s:w.s,e:w.e})),
    observations:[...(active.coarse??[]),...(active.focused??[])],
    instruction:args.instruction,
    qaIssues:active.qaIssues??[],
  }
}

function verifyFullSourceCuts(cuts:readonly YtSelectedCut[],args:YtPlanArgs):void{
  if(!cuts.length)throw Error('yt_no_approved_cuts')
  const sourceIndex=new Map(args.sources.map((s,i)=>[s.sourceId,i]))
  let lastSource=-1
  const endBySource=new Map<string,number>()
  for(const c of cuts){
    const index=sourceIndex.get(c.sourceId)
    if(index===undefined)throw Error('yt_unknown_cut_source')
    const source=args.sources[index]!
    if(!Number.isSafeInteger(c.startMs)||!Number.isSafeInteger(c.endMs) ||
      c.startMs<0||c.endMs-c.startMs<200||c.endMs>source.durationMs)
      throw Error('yt_invalid_cut_bounds')
    if(index<lastSource || c.startMs<(endBySource.get(c.sourceId)??0))
      throw Error('yt_cut_order_or_overlap')
    lastSource=index
    endBySource.set(c.sourceId,c.endMs)
  }
}

/** Durable stage machine. Gemini is always a queued worker job; web requests
 * NEVER block waiting for the long video watcher. Every LLM stage/checkpoint
 * is individually resumable through the existing YouTube GET polling API. */
export async function ytAdvanceLongForm(args:YtPlanArgs):Promise<YtProgress>{
  const key=sourceKey(args)
  const checkpoint:YtCheckpoint=args.checkpoint
    ? {...args.checkpoint,steps:[...args.checkpoint.steps],
      finished:[...args.checkpoint.finished],
      activeWindows:args.checkpoint.activeWindows?.map(w=>({...w})),
      active:args.checkpoint.active?{...args.checkpoint.active}:null}
    : {version:1,sourcesKey:key,active:null,finished:[],steps:[]}
  if(checkpoint.version!==1||checkpoint.sourcesKey!==key)
    throw Error('yt_checkpoint_source_signature_changed')

  const log=(stage:string,event:string,fields:Parameters<typeof ytLog>[4]={})=>
    ytLog(args.runId,checkpoint,stage,event,fields)
  const persist=async()=>args.save(checkpoint)
  const all=ytAllWindows(args)

  /** Retain only speech at exact source-word boundaries and observed visual shots. */
  const grounded=(ctx:YtWindowContext,cuts:YtSelectedCut[]):YtSelectedCut[]=>{
    let lastEnd=ctx.startMs
    return cuts.filter(cut=>{
      if(cut.sourceId!==ctx.sourceId||cut.startMs<lastEnd||
        cut.startMs<ctx.startMs||cut.endMs>ctx.endMs||cut.endMs-cut.startMs<200)return false
      const valid=cut.kind==='visual'&&ytVisualSceneCovered(ctx,cut.startMs,cut.endMs)
      if(valid)lastEnd=cut.endMs
      return valid
    })
  }

  const identity=(w:{sourceIndex:number;startMs:number;endMs:number}) =>
    [w.sourceIndex,w.startMs,w.endMs].join(':')
  const finishedKeys=new Set(checkpoint.finished.map(identity))
  const activeWindows:YtActiveWindow[]=[
    ...(checkpoint.activeWindows??(checkpoint.active?[checkpoint.active]:[])),
  ]
  const activeKeys=new Set(activeWindows.map(identity))
  for(const next of all){
    if(activeWindows.length>=4)break
    const id=identity(next)
    if(finishedKeys.has(id)||activeKeys.has(id))continue
    activeWindows.push({...next,stage:'coarse_queue'})
    activeKeys.add(id)
    log('window','start',{sourceIndex:next.sourceIndex,
      windowIndex:all.findIndex(w=>identity(w)===id),windowCount:all.length})
  }
  checkpoint.active=null // upgraded legacy single-window checkpoint
  checkpoint.activeWindows=activeWindows
  if(activeWindows.length){
    await Promise.all(activeWindows.map(async window=>{
      const windowIndex=all.findIndex(w=>identity(w)===identity(window))
      if(windowIndex<0)throw Error('yt_parallel_window_mismatch')
      const source=args.sources[window.sourceIndex]!
      const ctx=makeWindowContext(args,window,windowIndex,all.length)
      const fields={sourceIndex:window.sourceIndex,windowIndex,windowCount:all.length}
    switch(window.stage){
      case 'coarse_queue':{
        log('gemini_coarse','start',fields)
        const storageKey=await ytGetMediaKey(args,window.sourceIndex,window.endMs)
        window.coarseJobId=await ytFindMoments({
          runId:args.runId,projectId:source.projectId,sourceId:source.sourceId,
          storageKey,startMs:window.startMs,endMs:window.endMs,words:ctx.words,
        })
        window.stage='coarse_wait'
        log('gemini_coarse','queued',fields)
        break
      }
      case 'coarse_wait':{
        if(!window.coarseJobId)throw Error('yt_coarse_job_id_missing')
        const result=await ytReadMomentsJob(window.coarseJobId,
          [window.startMs,window.endMs],'coarse')
        if(result.status==='pending'){
          // Waiting is not a new checkpoint event on every driver tick.
          return
        }
        window.coarse=result.observations
        window.stage='focus_queue'
        log('gemini_coarse','done',{...fields,count:result.observations.length})
        break
      }
      case 'focus_queue':{
        log('gemini_focus','start',fields)
        const storageKey=await ytGetMediaKey(args,window.sourceIndex,window.endMs)
        const id=await ytRefineVisualStoryEvidence({
          runId:args.runId,projectId:source.projectId,sourceId:source.sourceId,
          storageKey,startMs:window.startMs,endMs:window.endMs,words:ctx.words,
          coarse:window.coarse??[],
        })
        window.focusJobId=id??undefined
        window.stage=id?'focus_wait':'story'
        log('gemini_focus',id?'queued':'no_focus_windows',fields)
        break
      }
      case 'focus_wait':{
        if(!window.focusJobId)throw Error('yt_focus_job_id_missing')
        const result=await ytReadMomentsJob(window.focusJobId,
          [window.startMs,window.endMs],'focused')
        if(result.status==='pending')return
        window.focused=result.observations
        window.stage='story'
        log('gemini_focus','done',{...fields,count:result.observations.length})
        break
      }
      case 'story':{
        log('specialist_story','start',fields)
        if(!ctx.observations.length&&!ctx.words.length)throw Error('yt_no_source_evidence')
        window.outline=await ytCreateEditorialHandoff(ctx)
        window.stage='footage'
        log('specialist_story','done',fields)
        break
      }
      case 'footage':{
        if(!window.outline)throw Error('yt_outline_missing')
        log('specialist_footage','start',fields)
        const proposed=await ytSelectFootage(ctx,window.outline)
        window.cuts=proposed.cuts
        window.rejected=proposed.rejected
        window.stage='dialogue'
        log('specialist_footage','validated',{...fields,
          accepted:proposed.cuts.length,rejected:proposed.rejected.length})
        break
      }
      case 'dialogue':{
        if(!window.outline||!window.cuts)throw Error('yt_footage_missing')
        log('specialist_dialogue_picture','start',fields)
        const result=await ytDialoguePictureReview(ctx,window.outline,window.cuts)
        window.cuts=result.cuts
        window.rejected=[...(window.rejected??[]),...result.rejected]
        window.stage='finisher'
        log('specialist_dialogue_picture','done',{...fields,
          accepted:result.cuts.length,rejected:result.rejected.length})
        break
      }
      case 'finisher':{
        if(!window.outline||!window.cuts)throw Error('yt_footage_missing')
        log('specialist_finisher','start',fields)
        try{
          window.cuts=await ytRunStoryFinisher(ctx,window.outline,window.cuts,window.qaIssues??[])
          window.stage='qa'
          log('specialist_finisher','done',{...fields,count:window.cuts.length})
        }catch(error){
          if((window.qaRevisionCount??0)<2)throw error
          window.cuts=grounded(ctx,window.cuts)
          if(!window.cuts.length)throw Error('yt_no_grounded_window_cuts')
          window.qaPassed=false
          window.qaIssues=[...(window.qaIssues??[]),`Finisher failed: ${ytErrorCode(error)}`]
          window.qaIssueHistory=[...(window.qaIssueHistory??[]),`Finisher failed: ${ytErrorCode(error)}`]
          window.stage='commit'
          log('specialist_qa','window_qa_soft_fail',{...fields,code:ytErrorCode(error),
            accepted:window.cuts.length,issues:window.qaIssues})
        }
        break
      }
      case 'qa':{
        if(!window.outline||!window.cuts)throw Error('yt_footage_missing')
        log('specialist_qa','start',fields)
        const review=await ytQualityReview(ctx,window.outline,window.cuts)
        if(review.pass){
          window.qaPassed=true
          window.qaRounds=(window.qaRounds??[]).map(round=>({...round,resolution:'Passed after revision'}))
          window.stage='commit'
          log('specialist_qa','passed',fields)
        }else{
          window.qaPassed=false
          window.qaIssues=review.issues
          window.qaIssueHistory=[...(window.qaIssueHistory??[]),...review.issues]
          window.qaRounds=[...(window.qaRounds??[]),{round:window.qaRevisionCount??0,issues:review.issues,resolution:'Rejected; revision requested'}]
          if((window.qaRevisionCount??0)<2){
            window.qaRevisionCount=(window.qaRevisionCount??0)+1
            window.qaRevisionAttempted=true
            // Replan from the screen with the actual QA report, not only trim existing cuts.
            window.stage='story'
            log('specialist_qa','revision_requested',{...fields,
              count:window.qaRevisionCount,issues:review.issues})
          }else{
            window.cuts=grounded(ctx,window.cuts)
            if(!window.cuts.length)throw Error('yt_no_grounded_window_cuts')
            window.qaRounds=(window.qaRounds??[]).map(round=>({...round,resolution:'Unresolved — owner approval needed'}))
            window.stage='commit'
            log('specialist_qa','window_needs_review',{...fields,
              code:'yt_qa_rejected_story',issues:review.issues})
          }
        }
        break
      }
      case 'commit':{
        if(!window.outline||!window.cuts?.length)throw Error('yt_window_not_verified')
        const current={
          sourceIndex:window.sourceIndex,startMs:window.startMs,endMs:window.endMs,
          outline:window.outline,cuts:window.cuts,
          rejected:window.rejected??[],
          coarseCount:window.coarse?.length??0,focusedCount:window.focused?.length??0,
          qaIssues:window.qaIssues,
          qaIssueHistory:window.qaIssueHistory??[],qaPassed:window.qaPassed===true,
          qaRounds:window.qaRounds??[],
          observedScenes:ctx.observations,
        }
        checkpoint.finished.push(current)
        log('window','done',{...fields,accepted:current.cuts.length,
          rejected:current.rejected.length})
        break
      }
      default:throw Error('yt_unrecognized_stage')
    }

    }))
    const doneKeys=new Set(checkpoint.finished.map(identity))
    checkpoint.activeWindows=activeWindows.filter(w=>!doneKeys.has(identity(w)))
    checkpoint.finished.sort((a,b)=>a.sourceIndex-b.sourceIndex||a.startMs-b.startMs)
    await persist()
    return {done:false,checkpoint}
  }

  if(checkpoint.finished.length!==all.length)throw Error('yt_missing_analysis_windows')
  if(!checkpoint.final){
    log('global_story','start',{count:checkpoint.finished.length})
    const next=await ytFinishWholeSourceStory(checkpoint.finished)
    checkpoint.final={...next,qaPassed:false}
    log('global_story','planned',{count:next.selectedIndices.length})
    await persist()
    return {done:false,checkpoint}
  }
  if(!checkpoint.final.qaPassed){
    log('global_qa','start',{count:checkpoint.final.selectedIndices.length,
      windowCount:all.length})
    const review=await ytQaWholeSourceStory(checkpoint.finished,{
      ...checkpoint.final,chapterTitles:checkpoint.final.chapterTitles??[],
    })
    if(review.pass){
      checkpoint.final.qaPassed=true
      checkpoint.final.qaRounds=(checkpoint.final.qaRounds??[]).map(round=>({...round,resolution:'Passed after revision'}))
      log('global_qa','passed',{windowCount:all.length})
    }else{
      checkpoint.final.qaIssues=review.issues
      checkpoint.final.qaIssueHistory=[...(checkpoint.final.qaIssueHistory??[]),...review.issues]
      checkpoint.final.qaRounds=[...(checkpoint.final.qaRounds??[]),{round:checkpoint.final.qaRevisionCount??0,issues:review.issues,resolution:'Rejected; revision requested'}]
      if((checkpoint.final.qaRevisionCount??0)<2){
        const prior={...checkpoint.final,chapterTitles:checkpoint.final.chapterTitles??[]}
        const revised=await ytFinishWholeSourceStory(checkpoint.finished,{
          issues:review.issues,previousSelection:prior,
        })
        checkpoint.final={...checkpoint.final,...revised,
          qaPassed:false,qaRevisionCount:(checkpoint.final.qaRevisionCount??0)+1}
        log('global_qa','revision_requested',{issues:review.issues,
          count:checkpoint.final.qaRevisionCount,windowCount:all.length})
      }else{
        checkpoint.final.qaPassed=true
        checkpoint.final.needsReview=true
        checkpoint.final.qaRounds=(checkpoint.final.qaRounds??[]).map(round=>({...round,resolution:'Unresolved — owner approval needed'}))
        log('global_qa','needs_review',{issues:review.issues,
          windowCount:all.length,code:'yt_global_qa_rejected'})
      }
    }
    await persist()
    return {done:false,checkpoint}
  }

  const candidates=checkpoint.finished.flatMap(w=>w.cuts)
  const approved=checkpoint.final.selectedIndices.map(i=>candidates[i]!)
  if(approved.some(c=>c.kind!=='visual'))throw Error('yt_gaming_speech_only_cut_forbidden')
  verifyFullSourceCuts(approved,args)
  log('assembly_validation','passed',{accepted:approved.length})
  await persist()
  const option:YoutubeVideoOption={
    id:'yt_long_form_shared',title:checkpoint.final.title,
    premise:checkpoint.final.premise,
    beats:approved.map((cut,i)=>({
      sourceId:cut.sourceId,startMs:cut.startMs,endMs:cut.endMs,
      label:checkpoint.final!.chapterTitles?.[i] || cut.beat || cut.reason,
    })),
    estDurationMs:approved.reduce((sum,cut)=>sum+cut.endMs-cut.startMs,0),
  }
  return {done:true,checkpoint,options:[option]}
}
