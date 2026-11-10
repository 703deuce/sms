import 'server-only'
import {createId} from '@/lib/supabase/id'
import {getPrisma} from '@/lib/server/db'
import {streamerAgentWindows} from '@/lib/streamer/agent-windows'
import {createAgentVideoWindow} from '@/lib/server/streamer/agent-window-source'
import {createAiProducerAgentRun} from '@/lib/server/ai-producer-agent/runs'
import {startUnifiedClipRun} from '@/lib/server/ai-producer-agent/unified-clip-run'
import {shouldAutoStartUploadAgentBatch} from '@/lib/ai-captions/auto-agent-guard'
import {storyTargetFromAgentSeconds} from '@/lib/ai-producer-agent/clip-mode/unified-run-input'
import {aiProducerAgentServerEnabled} from '@/lib/ai-producer-agent/flags'
import {readStreamerAgentBatch,streamerAgentSettings as asSettings,
  type StreamerAgentBatch as AgentBatch,type StreamerAgentMode as Mode}
  from '@/lib/streamer/agent-batch-contract'
export {readStreamerAgentBatch} from '@/lib/streamer/agent-batch-contract'

export async function startStreamerAgentBatch(workspaceId:string,projectId:string,
  mode:Mode,seconds:30|60|90,opts?:{onlyIfAbsent?:boolean}){
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
  if(!source.transcriptWords&&!source.transcriptKey)
    throw Error('agent_clip_batch_requires_source_transcript')
  const current=readStreamerAgentBatch(source.settings)
  if(current?.status==='running')throw Error('stream_agent_batch_already_running')
  if(opts?.onlyIfAbsent && asSettings(source.settings).agentClipBatch)
    throw Error('agent_clip_batch_already_exists')
  const windows=streamerAgentWindows(source.rangeStartMs,
    source.rangeEndMs-source.rangeStartMs,true)
  // Do not launch unbounded costs on a malformed duration.
  if(windows.length>32)throw Error('stream_agent_batch_exceeds_32_windows')
  const batch:AgentBatch={
    id:createId('sagent'),status:'running',mode,seconds,
    index:0,total:windows.length,sourceStartMs:source.rangeStartMs,
    sourceDurationMs:source.rangeEndMs-source.rangeStartMs,
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
    select:{workspaceId:true,status:true,deletedAt:true,uploadId:true,settings:true,
      rangeStartMs:true,rangeEndMs:true,title:true}})
  if(!p||p.deletedAt||p.status!=='READY'||!p.uploadId)return null
  const settings=asSettings(p.settings)
  // Regular upload clipper: any auto-agent mode starts one unified job.
  // Stream clipping uses startStreamerAgentBatch / startUnifiedClipRun later.
  // Captions-only projects must never start a unified clip run, even if a
  // workspace autoAgentClipMode leaked onto settings.
  if(!shouldAutoStartUploadAgentBatch(settings))return null
  const value=Number(settings.autoAgentClipSeconds)
  const rangeMs:[number,number]=[p.rangeStartMs,p.rangeEndMs]
  if(!(rangeMs[1]-rangeMs[0]>=15_000))return null
  try{
    const run=await startUnifiedClipRun(p.workspaceId,{
      source:{
        sourceId:'uploaded_recording',kind:'upload',projectId,
        rangeMs,durationMs:rangeMs[1]-rangeMs[0],title:p.title,
      },
      targetLengthS:storyTargetFromAgentSeconds(value),
    })
    const saved=await prisma.$executeRaw`
      UPDATE clip_projects
      SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{unifiedClipRunId}',
        ${JSON.stringify(run.id)}::jsonb),
          "updatedAt"=NOW()
      WHERE id=${projectId}
        AND (settings->'unifiedClipRunId') IS NULL
        AND (settings->'agentClipBatch') IS NULL
    `
    if(saved!==1)return null
    return run
  }catch(error){
    const reason=String((error as Error).message)
    if(reason==='agent_clip_batch_already_exists'||reason==='ai_producer_agent_run_in_progress')return null
    console.error('[clipper:agent] auto_start_failed',{projectId,reason})
    await prisma.$executeRaw`
      UPDATE clip_projects
      SET settings=jsonb_set(COALESCE(settings,'{}'::jsonb),'{autoAgentClipError}',
        ${JSON.stringify(reason.slice(0,200))}::jsonb)
      WHERE id=${projectId}
        AND (settings->'unifiedClipRunId') IS NULL
        AND (settings->'agentClipBatch') IS NULL
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
export async function tickStreamerAgentBatch(projectId:string,batchId:string){
  const prisma=getPrisma()
  const p=await prisma.clipProject.findUnique({where:{id:projectId},include:{streamVod:{select:{id:true,platform:true}}}})
  const batch=readStreamerAgentBatch(p?.settings)
  if(!p||!batch||batch.id!==batchId||batch.status!=='running')
    return {status:'not_active'}
  const windows=streamerAgentWindows(batch.sourceStartMs,
    batch.sourceDurationMs,true)
  const next:AgentBatch={...batch,completed:[...batch.completed],
    errors:[...batch.errors]}
  if(next.index>=windows.length){
    next.status='done'
    await persistStep(projectId,batchId,next)
    return {status:'done'}
  }
  const [start,end]=windows[next.index]!
  if(next.runId){
    const run=await prisma.aiProducerAgentRun.findFirst({
      where:{id:next.runId,workspaceId:p.workspaceId},
      select:{status:true,resultProjectId:true,resultClipId:true,error:true},
    })
    if(run&&['ready','done','failed','canceled','capped'].includes(run.status)){
      if(['ready','done'].includes(run.status)&&run.resultClipId&&run.resultProjectId){
        next.completed.push({clipId:run.resultClipId,
          projectId:run.resultProjectId,
          startMin:Math.floor((start-next.sourceStartMs)/60_000)})
      }else{
        next.errors.push(`Window ${next.index+1}: ${run?.error??'No valid clip'}`)
      }
      next.runId=undefined;next.preparedProjectId=undefined
      next.index++
      if(next.index>=windows.length)next.status='done'
    }
  }else if(next.preparedProjectId){
    const prepared=await prisma.clipProject.findFirst({
      where:{id:next.preparedProjectId,workspaceId:p.workspaceId},
      select:{status:true,rangeEndMs:true,uploadId:true,
        jobs:{where:{type:'STREAM_AGENT_PREPARE'},take:1,
          orderBy:{createdAt:'desc'},select:{status:true,error:true}}},
    })
    if(prepared?.status==='READY'&&prepared.uploadId){
      try{
        const run=next.mode==='clip_unified_v1'
          ? await startUnifiedClipRun(p.workspaceId,{
              source:{sourceId:'stream_recording',kind:'stream',
                projectId:next.preparedProjectId,rangeMs:[0,prepared.rangeEndMs]},
              targetLengthS:storyTargetFromAgentSeconds(next.seconds),
            })
          : await createAiProducerAgentRun(p.workspaceId,null,{
          sources:[{sourceId:'stream_recording',kind:'stream',
            projectId:next.preparedProjectId,rangeMs:[0,prepared.rangeEndMs]}],
          outputType:'story',storyMode:next.mode,
          targetLengthS:storyTargetFromAgentSeconds(next.seconds),
          visualEvidenceMode:'visual_audio',exportOnFinish:true,
          instruction:next.mode==='clip_moment_v1'
            ? 'Choose a continuous streamer action with genuine setup and reaction.'
            : 'Create one short narrative from distinct source-grounded beats.',
        })
        next.runId=run.id
      }catch(err){
        // Other workspace AI work may be active. The next queued batch tick
        // will retry, rather than dropping a prepared video or publishing fake clips.
        const reason=String((err as Error).message)
        if(reason!=='ai_producer_agent_run_in_progress'){
          next.errors.push(`Window ${next.index+1}: ${reason.slice(0,160)}`)
          next.preparedProjectId=undefined;next.index++
        }
      }
    }else if(prepared?.status==='FAILED'||
      prepared?.jobs[0]?.status==='FAILED'||!prepared){
      next.errors.push(`Window ${next.index+1}: ${prepared?.jobs[0]?.error??'Video preparation failed'}`)
      next.preparedProjectId=undefined;next.index++
    }
    if(next.index>=windows.length)next.status='done'
  }else if(p.uploadId && (!p.streamVod || p.streamVod.platform==='upload')){
    // Uploaded videos already have real video and transcript; no VOD fetch or
    // STREAM_AGENT_PREPARE job is necessary. Use the same specialist run.
    try{
      const run=next.mode==='clip_unified_v1'
        ? await startUnifiedClipRun(p.workspaceId,{
            source:{sourceId:'uploaded_recording',kind:'upload',projectId,
              rangeMs:[start,end]},
            targetLengthS:storyTargetFromAgentSeconds(next.seconds),
          })
        : await createAiProducerAgentRun(p.workspaceId,null,{
        sources:[{sourceId:'uploaded_recording',kind:'upload',projectId,
          rangeMs:[start,end]}],
        outputType:'story',storyMode:next.mode,
        targetLengthS:storyTargetFromAgentSeconds(next.seconds),
        visualEvidenceMode:'visual_audio',exportOnFinish:true,
        instruction:next.mode==='clip_moment_v1'
          ? 'Choose one genuine continuous moment with setup, action and reaction.'
          : 'Create one coherent narrative from distinct original source beats.',
      })
      next.runId=run.id
    }catch(err){
      const reason=String((err as Error).message)
      if(reason!=='ai_producer_agent_run_in_progress'){
        next.errors.push(`Window ${next.index+1}: ${reason.slice(0,160)}`)
        next.index++
        if(next.index>=windows.length)next.status='done'
      }
    }
  }else{
    try{
      const prepared=await createAgentVideoWindow(p.workspaceId,{
        parentProjectId:projectId,rangeStartMs:start,rangeEndMs:end})
      next.preparedProjectId=prepared.projectId
    }catch(err){
      next.errors.push(`Window ${next.index+1}: ${String((err as Error).message).slice(0,160)}`)
      next.index++
      if(next.index>=windows.length)next.status='done'
    }
  }
  await persistStep(projectId,batchId,next)
  return {status:next.status,index:next.index,total:next.total}
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
