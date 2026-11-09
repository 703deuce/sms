import 'server-only'
import {createId} from '@/lib/supabase/id'
import {getPrisma} from '@/lib/server/db'
import {streamerAgentWindows} from '@/lib/streamer/agent-windows'
import {createAgentVideoWindow} from '@/lib/server/streamer/agent-window-source'
import {createAiProducerAgentRun} from '@/lib/server/ai-producer-agent/runs'
import {enqueueAiProducerAnalyzeJob} from '@/lib/server/ai-producer-agent/enqueue-analyze'
import {resolveAiProducerSources} from '@/lib/server/ai-producer-agent/resolve-sources'
import {loadRoughCutWords} from '@/lib/server/ai-producer-agent/rough-cut-source'
import {timestampedAsrForVisual} from '@/lib/ai-producer-agent/visual-evidence'
import {scoreFinishedAgentClip} from '@/lib/streamer/agent-clip-scoring'
import {rankAgentClipCandidates,rankedCompletedAgentClips,sameFinishedCut}
  from '@/lib/streamer/agent-clip-ranking'
import {aiProducerAgentServerEnabled} from '@/lib/ai-producer-agent/flags'
import {readStreamerAgentBatch,streamerAgentSettings as asSettings,
  type StreamerAgentBatch as AgentBatch,type StreamerAgentMode as Mode}
  from '@/lib/streamer/agent-batch-contract'
export {readStreamerAgentBatch} from '@/lib/streamer/agent-batch-contract'

export async function startStreamerAgentBatch(workspaceId:string,projectId:string,
  mode:Mode,seconds:30|60|90,opts?:{onlyIfAbsent?:boolean;allWindows?:boolean;selectedStartMin?:number}){
  if(!aiProducerAgentServerEnabled())throw Error('ai_producer_agent_disabled')
  const prisma=getPrisma()
  const source=await prisma.clipProject.findFirst({
    where:{id:projectId,workspaceId,deletedAt:null,status:'READY'},
    include:{streamVod:{include:{channel:true}},upload:true},
  })
  if(!source)throw Error('agent_clip_source_not_ready')
  const isStream=Boolean(source.streamVod && source.streamVod.platform!=='upload')
  if(isStream){
    if(!['twitch','kick'].includes(source.streamVod!.platform))
      throw Error('stream_agent_batch_requires_twitch_kick_vod')
    if(!source.streamVod!.url)throw Error('stream_agent_batch_vod_url_missing')
    if(!source.streamVod!.attestedAt&&
      !(source.streamVod!.channel?.status==='CONNECTED'&&!source.streamVod!.channel?.deletedAt))
      throw Error('stream_agent_batch_source_permission_required')
  }else if(!source.uploadId||!source.upload){
    throw Error('agent_clip_batch_requires_uploaded_video')
  }
  // Video-only events are valid candidates. Only READY source media is mandatory.
  const current=readStreamerAgentBatch(source.settings)
  if(current?.status==='running')throw Error('stream_agent_batch_already_running')
  if(opts?.onlyIfAbsent && asSettings(source.settings).agentClipBatch)
    throw Error('agent_clip_batch_already_exists')
  const allWindows=opts?.allWindows??true
  const selectedStartMin=opts?.selectedStartMin??0
  const windows=streamerAgentWindows(source.rangeStartMs,
    source.rangeEndMs-source.rangeStartMs,allWindows,selectedStartMin)
  // Do not launch unbounded costs on a malformed duration.
  if(windows.length>32)throw Error('stream_agent_batch_exceeds_32_windows')
  const batch:AgentBatch={
    id:createId('sagent'),status:'running',mode,seconds,
    index:0,total:windows.length,sourceStartMs:source.rangeStartMs,
    sourceDurationMs:source.rangeEndMs-source.rangeStartMs,
    allWindows,selectedStartMin,
    completed:[],errors:[],startedAt:new Date().toISOString(),
  }
  await prisma.$transaction(async (tx:Pick<typeof prisma,'clipProject'|'clipJob'|'$executeRaw'>)=>{
    if(opts?.onlyIfAbsent){
      const n=await tx.$executeRaw`
        UPDATE clip_projects
        SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{agentClipBatch}',${JSON.stringify(batch)}::jsonb),
            "updatedAt"=NOW()
        WHERE id=${projectId} AND (settings->'agentClipBatch') IS NULL
      `
      if(n!==1)throw Error('agent_clip_batch_already_exists')
    }else{
      await tx.clipProject.update({where:{id:projectId},data:{
        settings:JSON.parse(JSON.stringify({...asSettings(source.settings),agentClipBatch:batch})),
      }})
    }
    await tx.clipJob.create({data:{
      id:createId('job'),projectId,type:'STREAM_AGENT_BATCH',
      status:'QUEUED',priority:10,maxAttempts:2,payload:{batchId:batch.id},
    }})
  })
  return batch
}
/** Safe to call after any READY PROCESS_PROJECT worker callback.
 * A single SQL CAS and the batch job insertion share one transaction. */
export async function maybeAutoStartUploadAgentBatch(projectId:string){
  const prisma=getPrisma()
  const p=await prisma.clipProject.findUnique({where:{id:projectId},
    select:{workspaceId:true,status:true,deletedAt:true,uploadId:true,settings:true}})
  if(!p||p.deletedAt||p.status!=='READY'||!p.uploadId)return null
  const settings=asSettings(p.settings)
  const mode=settings.autoAgentClipMode
  if(mode!=='clip_moment_v1'&&mode!=='clip_story_v1')return null
  if(settings.agentClipBatch)return null
  const value=Number(settings.autoAgentClipSeconds)
  const seconds=(value===30||value===90?value:60) as 30|60|90
  try{
    return await startStreamerAgentBatch(p.workspaceId,projectId,mode,seconds,
      {onlyIfAbsent:true})
  }catch(error){
    const reason=String((error as Error).message)
    if(reason==='agent_clip_batch_already_exists')return null
    console.error('[clipper:agent] auto_start_failed',{projectId,reason})
    // Never overwrite an independently started batch or newer settings.
    await prisma.$executeRaw`
      UPDATE clip_projects
      SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{autoAgentClipError}',
        ${JSON.stringify(reason.slice(0,200))}::jsonb)
      WHERE id=${projectId} AND (settings->'agentClipBatch') IS NULL
    `.catch(()=>null)
    return null
  }
}

async function persistStep(projectId:string,expectedId:string,next:AgentBatch){
  const prisma=getPrisma()
  await prisma.$transaction(async (tx:Pick<typeof prisma,'clipProject'|'clipJob'>)=>{
    const project=await tx.clipProject.findUniqueOrThrow({where:{id:projectId}})
    const current=readStreamerAgentBatch(project.settings)
    if(current?.id!==expectedId||current.status!=='running')return
    await tx.clipProject.update({where:{id:projectId},data:{
      settings:JSON.parse(JSON.stringify({
        ...asSettings(project.settings),agentClipBatch:next,
      })),
    }})
    if(next.status==='running'){
      await tx.clipJob.create({data:{
        id:createId('job'),projectId,type:'STREAM_AGENT_BATCH',
        status:'QUEUED',priority:10,maxAttempts:2,
        runAfter:new Date(Date.now()+20_000),payload:{batchId:expectedId},
      }})
    }
  })
}
/** Called only by the authenticated clips worker, one durable step per job.
 * One window and one AI Producer run remain active at a time. */
/** A durable discovery-to-production state machine. A window first receives
 * a genuine video+audio+transcript Gemini scout; multiple ranked candidate
 * events then EACH receive their own Story/Footage/Flow/QA run and MP4.
 * Long-form Producer modes and the classic clip picker never participate. */
export async function tickStreamerAgentBatch(projectId:string,batchId:string){
  const prisma=getPrisma()
  const p=await prisma.clipProject.findUnique({where:{id:projectId},
    include:{streamVod:{select:{id:true,platform:true}}}})
  const batch=readStreamerAgentBatch(p?.settings)
  if(!p||!batch||batch.id!==batchId||batch.status!=='running')
    return {status:'not_active'}
  const windows=streamerAgentWindows(batch.sourceStartMs,batch.sourceDurationMs,
    batch.allWindows??true,batch.selectedStartMin??0)
  const next:AgentBatch={...batch,completed:[...batch.completed],errors:[...batch.errors],
    candidates:batch.candidates?[...batch.candidates]:undefined}
  const moveWindow=()=>{
    next.index++
    next.candidates=undefined
    next.candidateIndex=undefined
    next.discoveryJobId=undefined
    next.preparedProjectId=undefined
    next.runId=undefined
    if(next.index>=windows.length)next.status='done'
  }
  if(next.index>=windows.length){
    next.status='done'
    next.completed=rankedCompletedAgentClips(next.completed)
    await persistStep(projectId,batchId,next)
    return {status:'done'}
  }
  const [sourceWindowStart,sourceWindowEnd]=windows[next.index]!
  const isUploaded=Boolean(p.uploadId&&(!p.streamVod||p.streamVod.platform==='upload'))
  const sourceProjectId=isUploaded?projectId:next.preparedProjectId
  const scopedWindow:[number,number]=isUploaded
    ?[sourceWindowStart,sourceWindowEnd]
    :[0,sourceWindowEnd-sourceWindowStart]
  const candidateIndex=next.candidateIndex??0
  if(next.runId){
    const run=await prisma.aiProducerAgentRun.findFirst({
      where:{id:next.runId,workspaceId:p.workspaceId},
      select:{status:true,resultProjectId:true,resultClipId:true,error:true,producerNotes:true},
    })
    if(run&&['ready','done','failed','canceled','capped'].includes(run.status)){
      const candidate=next.candidates?.[candidateIndex]
      if(['ready','done'].includes(run.status)&&run.resultClipId&&run.resultProjectId){
        const render=await prisma.clipRender.findFirst({
          where:{clipId:run.resultClipId,workspaceId:p.workspaceId},
          orderBy:{createdAt:'desc'},
          select:{status:true,outputKey:true,error:true,id:true},
        })
        // Producer READY means cuts were saved, not that its MP4 has exported.
        // Keep the durable cursor on this candidate until RENDER_CLIP finishes.
        if(render?.status==='QUEUED'||render?.status==='RENDERING'){
          await persistStep(projectId,batchId,next)
          return {status:'waiting_for_mp4',index:next.index,total:next.total,
            candidateIndex,renderId:render.id}
        }
        if(!render||render.status!=='READY'||!render.outputKey){
          next.errors.push('Candidate '+(candidateIndex+1)+': MP4 export failed or missing ('+
            (render?.error??render?.status??'no render')+')')
        }else{
        const outputNotes=run.producerNotes as Record<string,unknown>|null
        const outputs=Array.isArray(outputNotes?.outputs)?outputNotes.outputs:[]
        const firstOutput=outputs[0] as Record<string,unknown>|undefined
        const specialists=firstOutput?.specialists as Record<string,unknown>|undefined
        const review=specialists?.review as Record<string,unknown>|undefined
        const qaPass=review?.pass===true
        const rating=typeof review?.rating==='number'&&Number.isFinite(review.rating)?
          Number(review.rating):undefined
        const rawCuts=Array.isArray(specialists?.approvedCuts)?specialists.approvedCuts:[]
        const sourceCutsMs:Array<[number,number]>=rawCuts.filter((item):item is Record<string,unknown>=>
          !!item&&typeof item==='object'&& !Array.isArray(item)).map(item=>
          [Number(item.startMs)+(isUploaded?0:sourceWindowStart),
            Number(item.endMs)+(isUploaded?0:sourceWindowStart)] as [number,number]).filter(([start,end])=>
          Number.isFinite(start)&&Number.isFinite(end)&&end>start)
        const resultDuration=sourceCutsMs.reduce((sum,[a,b])=>sum+b-a,0)
        const composite=scoreFinishedAgentClip({
          qaRating:rating,finderRating:candidate?.score??0,
          objective:{
            sourceBounded:sourceCutsMs.length>0&&sourceCutsMs.every(([a,b])=>
              a>=sourceWindowStart&&b<=sourceWindowEnd),
            noOverlaps:sourceCutsMs.every(([a,b],i)=>i===0||a>=sourceCutsMs[i-1]![1]),
            durationMs:resultDuration,maxDurationMs:next.seconds*1000,
            hasOutput:Boolean(render.outputKey),
          },
        })
        const duplicate=sourceCutsMs.length>0&&next.completed.some(done=>
          sameFinishedCut(sourceCutsMs,done.sourceCutsMs??[]))
        if(duplicate){
          next.errors.push('Candidate '+(candidateIndex+1)+': similar finished cut already ranked; duplicate hidden')
        }else{
          // Do not claim a weighted score without a real QA grade.
          // Persist actual scoring evidence on the normal clip, so the
          // existing project gallery sorts finished results by score.
          const score=composite.score??Math.max(0,Math.min(100,candidate?.score??0))
          await prisma.clip.update({
            where:{id:run.resultClipId},
            data:{
              score,
              scores:JSON.parse(JSON.stringify({
                ...(composite.score!==null?{total:composite.score}:{}),
                qa:composite.qaRating,finder:composite.finderRating,
                objective:composite.objectiveRating,
                weights:composite.weights,qaAvailable:composite.qaRating!==null,
              })),
              title:candidate?.title??'AI clip',
              reason:candidate?.reason??null,
            },
          })
          next.completed.push({clipId:run.resultClipId,projectId:run.resultProjectId,
            startMin:Math.floor(((isUploaded?0:sourceWindowStart)+
              (candidate?.rangeMs[0]??scopedWindow[0])-next.sourceStartMs)/60_000),
            score, candidateId:candidate?.id,reason:candidate?.reason,
            category:candidate?.category,qaPass,sourceCutsMs})
        }
        next.completed=rankedCompletedAgentClips(next.completed)
        }
      }else{
        next.errors.push('Candidate '+(candidateIndex+1)+' in window '+(next.index+1)+
          ': '+(run?.error??'No valid clip'))
      }
      next.runId=undefined
      next.candidateIndex=candidateIndex+1
      if((next.candidateIndex??0)>=(next.candidates?.length??0))moveWindow()
    }
  }else if(next.candidates){
    if(candidateIndex>=next.candidates.length){
      moveWindow()
    }else if(sourceProjectId){
      const candidate=next.candidates[candidateIndex]!
      try{
        const run=await createAiProducerAgentRun(p.workspaceId,null,{
          sources:[{sourceId:isUploaded?'uploaded_recording':'stream_recording',
            kind:isUploaded?'upload':'stream',projectId:sourceProjectId,
            rangeMs:candidate.rangeMs}],
          outputType:'story',storyMode:next.mode,
          targetLengthS:[15,next.seconds],
          visualEvidenceMode:'visual_audio',exportOnFinish:true,
          instruction:(next.mode==='clip_moment_v1'
            ? 'Produce ONE unbroken original-source moment, no internal cuts.'
            : 'Assemble one coherent original-source story with multiple real cuts.')+
            ' Ranked candidate '+(candidateIndex+1)+' of '+next.candidates.length+
            '. Discovery evidence: '+candidate.reason+
            '. Focus on THIS source event. Use actual video, original audio and transcript together.'+
            ' Do not reuse a different candidate story or invent visual events.',
        })
        next.runId=run.id
      }catch(err){
        const reason=String((err as Error).message)
        if(reason!=='ai_producer_agent_run_in_progress'){
          next.errors.push('Candidate '+(candidateIndex+1)+': '+reason.slice(0,180))
          next.candidateIndex=candidateIndex+1
          if(next.candidateIndex>=next.candidates.length)moveWindow()
        }
      }
    }
  }else if(next.discoveryJobId){
    const discovery=await prisma.clipJob.findUnique({
      where:{id:next.discoveryJobId},select:{status:true,error:true,payload:true},
    })
    if(!discovery||discovery.status==='FAILED'){
      next.errors.push('Discovery window '+(next.index+1)+': '+
        (discovery?.error??'Missing analysis job'))
      moveWindow()
    }else if(discovery.status==='DONE'){
      const payload=discovery.payload as Record<string,unknown>|null
      const response=payload?.analyzeResult as Record<string,unknown>|undefined
      const count=Math.min(8,Math.max(5,Math.ceil((scopedWindow[1]-scopedWindow[0])/30_000)))
      const candidates=rankAgentClipCandidates(response?.moments,scopedWindow,next.seconds,count)
      if(!candidates.length){
        next.errors.push('Discovery window '+(next.index+1)+': no real source-grounded moments')
        moveWindow()
      }else{
        next.candidates=candidates
        next.candidateIndex=0
        next.discoveredCount=(next.discoveredCount??0)+candidates.length
        next.discoveryJobId=undefined
      }
    }
  }else if(sourceProjectId){
    // Do not analyze a Twitch/Kick prepared source before its download and
    // transcript transaction has committed READY. It may still be PREPARING.
    const prepared=!isUploaded?await prisma.clipProject.findFirst({
      where:{id:sourceProjectId,workspaceId:p.workspaceId},
      select:{status:true,uploadId:true,
        jobs:{where:{type:'STREAM_AGENT_PREPARE'},take:1,
          orderBy:{createdAt:'desc'},select:{status:true,error:true}}},
    }):null
    if(prepared&&(prepared.status==='FAILED'||prepared.jobs[0]?.status==='FAILED')){
      next.errors.push('Window '+(next.index+1)+': '+
        (prepared.jobs[0]?.error??'Video preparation failed'))
      moveWindow()
    }else if(!isUploaded&&(!prepared||prepared.status!=='READY'||!prepared.uploadId)){
      // Next durable tick retries once actual source and ASR are ready.
    }else try{
      const source=await resolveAiProducerSources(p.workspaceId,[{
        sourceId:isUploaded?'uploaded_recording':'stream_recording',
        kind:isUploaded?'upload':'stream',projectId:sourceProjectId,
        rangeMs:scopedWindow,
      }])
      const words=await loadRoughCutWords(p.workspaceId,source[0]!,0)
      const job=await enqueueAiProducerAnalyzeJob({
        runId:batch.id,projectId:sourceProjectId,mode:'best_moments',
        sources:source, targetClipLenS:next.seconds,
        visualEvidence:{enabled:true,model:'gemini-3.1-flash-lite',
          transcriptText:timestampedAsrForVisual(words,scopedWindow)},
      })
      next.discoveryJobId=job.id
    }catch(err){
      next.errors.push('Discovery window '+(next.index+1)+': '+
        String((err as Error).message).slice(0,180))
      moveWindow()
    }
  }else{
    try{
      const prepared=await createAgentVideoWindow(p.workspaceId,{
        parentProjectId:projectId,rangeStartMs:sourceWindowStart,
        rangeEndMs:sourceWindowEnd,
      })
      next.preparedProjectId=prepared.projectId
    }catch(err){
      next.errors.push('Window '+(next.index+1)+': '+
        String((err as Error).message).slice(0,180))
      moveWindow()
    }
  }
  await persistStep(projectId,batchId,next)
  return {status:next.status,index:next.index,total:next.total,
    completed:next.completed.length,discovered:next.discoveredCount??0}
}
export async function cancelStreamerAgentBatch(workspaceId:string,projectId:string){
  const prisma=getPrisma()
  const project=await prisma.clipProject.findFirst({
    where:{id:projectId,workspaceId,deletedAt:null}})
  if(!project)throw Error('not_found')
  const current=readStreamerAgentBatch(project.settings)
  if(!current||current.status!=='running')return false
  await prisma.clipProject.update({where:{id:projectId},data:{
    settings:JSON.parse(JSON.stringify({...asSettings(project.settings),
      agentClipBatch:{...current,status:'canceled'}})),
  }})
  return true
}
